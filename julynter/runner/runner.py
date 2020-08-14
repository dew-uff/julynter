"""Define main runner class"""
import sys
import traceback
import time
import re

from copy import deepcopy
from math import ceil

import nbformat
import nbconvert
from jupyter_client.kernelspec import find_kernel_specs

from ..util import vprint, to_unicode, TimeoutException, Path
from .preprocessors import create_preprocessor
from .compare import cell_diff, DEFAULT_NORMALIZATION, DEFAULT_SIMILARITY


class StopRunException(Exception):
    """Represents an interruption of the execution"""

def clean_fail():
    """Return clean fail result dict"""
    return {
        "msg": None,
        "reason": None,
    }

def clean_result():
    """Return clean result dict"""
    return {
        "cell_order": [],
        "executed_cells": 0,
        "status": "not-run", # not-run, skipped, error, run
        "processed": ["attempt"], # attempt, loaded, timeout, exception
        "timeout": None,
        "duration": None,
        "last_cell_index": None,
        "count": None,
    }

def clean_diff_result():
    """Return clean diff result dict"""
    return {
        "diff": None,
        "diff_count": None,
        "diffnorm": None,
        "diffnorm_count": None,
        "processed": [], # finished, same-results, mismatch-results, same-norm, mismatch-norm
        "similarities": [],
    }


class Runner(object):
    """Run Jupyter notebooks"""
    # pylint: disable=useless-object-inheritance, too-many-instance-attributes

    def __init__(
            self, path, order, unsafe,
            kernel=None, force_fail=False, notebook_timeout=300, show_report=False,
            normalizations=DEFAULT_NORMALIZATION, calculate_similarity=DEFAULT_SIMILARITY,
            vindex=3
    ):
        # pylint: disable=dangerous-default-value, too-many-arguments
        self.kernel = kernel
        self.force_fail = force_fail
        self.notebook_timeout = notebook_timeout
        self.show_report = show_report
        self.normalizations = normalizations
        self.vindex = vindex
        self.calculate_similarity = calculate_similarity
        self.preprocessor = create_preprocessor(order, unsafe, vindex)
        self.path = Path(path).expanduser()
        self.notebook = None
        self.old_nb = None
        self.start_time = None

        self.result = clean_result()
        self.fail = clean_fail()
        self.diff_result = clean_diff_result()

    def _timeout_func(self, cell):
        """Define cell timeout"""
        # pylint: disable=unused-argument
        available = self.notebook_timeout - int(ceil(time.time() - self.start_time))
        return max(1, available)

    def load_file(self):
        """Load .ipynb file"""
        vprint(self.vindex, u"Reading file {}".format(to_unicode(self.path)))
        try:
            with open(str(self.path)) as fil:
                self.notebook = nbformat.read(fil, as_version=4)
            self.old_nb = deepcopy(self.notebook)
            self.update_processed("loaded")
        except OSError:
            vprint(self.vindex + 1, "Failed to open file")
            self.report_exit(
                "<Read notebook error>",
                traceback.format_exc()
            )

    def find_kernel(self):
        """Decide which kernel to use"""
        kernel_specs = find_kernel_specs()
        kernel = self.kernel
        if kernel:
            if kernel in kernel_specs:
                return kernel
            if self.force_fail:
                self.report_exit(
                    "<No available kernel>",
                    "Kernel {} not found".format(kernel)
                )
            else:
                vprint(self.vindex, (
                    "Configured Kernel {} not found. "
                    "Trying to detect other kernel"
                ).format(self.kernel))

        kernel = (
            self.notebook
            .get('metadata', {})
            .get('kernelspec', {})
            .get('name', 'python')
        )
        if kernel in kernel_specs:
            return kernel
        kernel = 'python'
        if kernel in kernel_specs:
            return kernel
        kernel = 'python{}'.format(sys.version_info[0])
        if kernel in kernel_specs:
            return kernel
        if kernel_specs:
            return next(iter(kernel_specs))
        return None

    def set_kernel(self, preprocessor):
        """Set preprocessor kernel"""
        kernel = self.find_kernel()
        if kernel is None:
            vprint(self.vindex, "No kernel found")
            self.report_exit(
                "<No available kernel>",
                "Kernel not found"
            )
        vprint(self.vindex, "Using kernel {}".format(kernel))
        preprocessor.kernel_name = kernel

    def execute_notebook(self, preprocessor):
        """Execute notebook"""
        preprocessor.timeout_func = self._timeout_func
        self.start_time = time.time()
        preprocessor.log.propagate = False
        preprocessor.preprocess(self.notebook, {'metadata': {'path': str(self.path.parent)}})
        preprocessor.log.propagate = True

    def run(self, clean=True):
        """Run notebook"""
        if clean:
            self.result = clean_result()
            self.fail = clean_fail()
        try:
            # pylint: disable=duplicate-except
            self.load_file()
            preprocessor = self.preprocessor()
            preprocessor.last_try = (-1, -1)
            self.set_kernel(preprocessor)
            skip = preprocessor.prepare_notebook_order(self.notebook, self.vindex)
            self.result["cell_order"] = preprocessor.cell_order
            if skip != "":
                vprint(self.vindex, "Skipping notebook. Reason: {}".format(skip))
                self.report_exit("<Skipping notebook>", skip, statuscode="skipped")

            timeout = 0
            try:
                vprint(self.vindex, "Executing notebook")
                self.execute_notebook(preprocessor)
                vprint(self.vindex + 1, "Finished")
            except TimeoutException:
                timeout = 1
                vprint(self.vindex + 1, "Timeout")
                self.update_processed("timeout")
            except RuntimeError:
                reason = "RuntimeError"
                vprint(self.vindex + 1, "Exception: {}".format(reason))
                self.update_processed("exception")
                self.update_reason(reason, traceback.format_exc())
            except AttributeError:
                reason = "Malformed Notebook"
                vprint(self.vindex + 1, "Exception: {}".format(reason))
                self.update_processed("exception")
                self.update_reason(reason, traceback.format_exc())
            except nbconvert.preprocessors.execute.CellExecutionError as exc:
                try:
                    reason = re.findall(r"\n(.*): .*\n$", str(exc))[-1]
                except IndexError:
                    reason = "<Unknown exception>"
                vprint(self.vindex + 1, "Exception: {}".format(reason))
                self.update_processed("exception")
                self.update_reason(reason, traceback.format_exc())

            vprint(self.vindex + 1, "Run up to {}".format(preprocessor.last_try))
            self.update_results(
                timeout=self.notebook_timeout,
                duration=time.time() - self.start_time,
                last_cell_index=preprocessor.last_try[1],
                count=preprocessor.last_try[0] + 1,
                executed_cells=preprocessor.last_try[0] + 1 - timeout,
                status="run"
            )
        except StopRunException:
            return False
        return True

    def compare(self, clean=True):
        """Compare notebook results"""
        if clean:
            self.diff_result = clean_diff_result()
        vprint(self.vindex, "Comparing notebooks")
        diff = []
        new_diff = []
        for _, index in zip(range(self.result["executed_cells"]), self.result["cell_order"]):
            vprint(self.vindex + 1, "Comparing cell {}".format(index))
            old_cell = self.old_nb.cells[index]
            new_cell = self.notebook.cells[index]
            original_equal, any_equal, diff_result = cell_diff(
                index, old_cell, new_cell, self.show_report,
                self.normalizations, self.calculate_similarity,
                self.vindex + 2
            )
            if not original_equal:
                diff.append(index)
            if not any_equal:
                new_diff.append(index)
            self.add_similarity(dict(
                index=index,
                **diff_result
            ))

        if not diff:
            vprint(self.vindex + 1, "Identical results")
            self.update_processed("same-results", usediff=True)
            self.update_results(
                usediff=True,
                diff="",
                diff_count=0
            )
        else:
            vprint(self.vindex + 1, "Diff on cells: {}".format(diff))
            self.update_processed("mismatch-results", usediff=True)
            self.update_results(
                usediff=True,
                diff=",".join(map(str, diff)),
                diff_count=len(diff)
            )

        if not new_diff:
            vprint(self.vindex + 1, "Identical results after normalizations")
            self.update_processed("same-norm", usediff=True)
            self.update_results(
                usediff=True,
                diffnorm="",
                diffnorm_count=0
            )
        else:
            vprint(self.vindex + 1, "Diff on cells after normalizations: {}".format(new_diff))
            self.update_processed("mismatch-norm", usediff=True)
            self.update_results(
                usediff=True,
                diffnorm=",".join(map(str, new_diff)),
                diffnorm_count=len(new_diff)
            )
        self.update_processed("finished", usediff=True)

    def save(self, output):
        """Save output notebook"""
        with open(str(output), "w") as fil:
            nbformat.write(self.notebook, fil)

    def update_processed(self, flag, usediff=False):
        """Add flag to processed"""
        res = self.diff_result if usediff else self.result
        res["processed"].append(flag)

    def update_reason(self, reason, msg):
        """Update execution reason and msg"""
        self.fail["reason"] = reason
        self.fail["msg"] = msg

    def update_results(self, usediff=False, **kwargs):
        """Update execution results"""
        res = self.diff_result if usediff else self.result
        for key, value in kwargs.items():
            if key in res:
                res[key] = value
            else:
                self.report_exit("<runner bug>", "Key {} not found in result dict".format(key))

    def add_similarity(self, sim):
        """Add similarity result to execution result"""
        self.diff_result["similarities"].append(sim)

    def report_exit(self, reason, msg, statuscode="error"):
        """Stop execution and give a reason"""
        self.update_reason(reason, msg)
        self.result["status"] = statuscode
        raise StopRunException()
