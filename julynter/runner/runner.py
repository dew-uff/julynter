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
from . import consts
from .preprocessors import create_preprocessor
from .compare import cell_diff, DEFAULT_NORMALIZATION, DEFAULT_SIMILARITY


class ExecutionResult(object):
    """Represents an execution result"""
    # pylint: disable=useless-object-inheritance, too-many-instance-attributes

    def __init__(self):
        self.reason = None
        self.msg = None
        self.cell = None
        self.count = None
        self.diff = None
        self.duration = None
        self.timeout = None
        self.diff_count = None
        self.processed = consts.E_INSTALLED
        self.statuscode = 0
        self.similarities = []
        self.has_diffs = 1

    def add_similarity(self, sim):
        """Add similarity dict to result"""
        self.similarities.append(sim)

    def __repr__(self):
        return repr(self.__dict__)


class StopRunException(Exception):
    """Represents an interruption of the execution"""


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

        self.execution = ExecutionResult()
        self.update_status(consts.E_INSTALLED)

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
            self.update_status(consts.E_LOADED)
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
        preprocessor.preprocess(self.notebook, {'metadata': {'path': str(self.path.parent)}})

    def run(self):
        """Run notebook"""
        try:
            # pylint: disable=duplicate-except
            self.load_file()
            preprocessor = self.preprocessor()
            preprocessor.last_try = (-1, -1)
            self.set_kernel(preprocessor)
            skip = preprocessor.prepare_notebook_order(self.notebook, self.vindex)
            if skip != "":
                vprint(self.vindex, "Skipping notebook. Reason: {}".format(skip))
                self.report_exit("<Skipping notebook>", skip, statuscode=0)

            timeout = 0
            try:
                vprint(self.vindex, "Executing notebook")
                self.execute_notebook(preprocessor)
                vprint(self.vindex + 1, "Finished")
            except TimeoutException:
                timeout = 1
                vprint(self.vindex + 1, "Timeout")
                self.update_status(consts.E_TIMEOUT)
            except RuntimeError:
                reason = "RuntimeError"
                vprint(self.vindex + 1, "Exception: {}".format(reason))
                self.update_status(consts.E_EXCEPTION)
                self.update_reason(reason, traceback.format_exc())
            except AttributeError:
                reason = "Malformed Notebook"
                vprint(self.vindex + 1, "Exception: {}".format(reason))
                self.update_status(consts.E_EXCEPTION)
                self.update_reason(reason, traceback.format_exc())
            except nbconvert.preprocessors.execute.CellExecutionError as exc:
                try:
                    reason = re.findall(r"\n(.*): .*\n$", str(exc))[-1]
                except IndexError:
                    reason = "<Unknown exception>"
                vprint(self.vindex + 1, "Exception: {}".format(reason))
                self.update_status(consts.E_EXCEPTION)
                self.update_reason(reason, traceback.format_exc())

            vprint(self.vindex + 1, "Run up to {}".format(preprocessor.last_try))
            self.update_results(
                timeout=self.notebook_timeout,
                duration=time.time() - self.start_time,
                cell=preprocessor.last_try[1],
                count=preprocessor.last_try[0] + 1
            )
            self.compare(preprocessor, timeout)
            self.update_status(consts.E_EXECUTED)
        except StopRunException:
            print(self.execution)
            sys.exit(self.execution.statuscode)

    def compare(self, preprocessor, timeout):
        """Compare notebook results"""
        vprint(self.vindex, "Comparing notebooks")
        diff = []
        new_diff = []
        for _, index in zip(range(preprocessor.last_try[0] + 1 - timeout), preprocessor.cell_order):
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
            self.update_status(consts.E_SAME_RESULTS)
            self.update_results(
                diff="",
                diff_count=0
            )
        else:
            vprint(self.vindex + 1, "Diff on cells: {}".format(diff))
            self.update_results(
                diff=",".join(map(str, diff)),
                diff_count=len(diff)
            )

        if not new_diff:
            vprint(self.vindex + 1, "Identical results after normalizations")
            self.update_has_diffs(consts.E_HAS_DIFFS_SAME)
        else:
            vprint(self.vindex + 1, "Diff on cells after normalizations: {}".format(new_diff))
            self.update_has_diffs(consts.E_HAS_DIFFS_MISMATCH)

    def update_status(self, new_status):
        """Update execution status"""
        self.execution.processed |= new_status

    def update_has_diffs(self, new_status):
        """Update execution diff status"""
        self.execution.has_diffs |= new_status

    def update_reason(self, reason, msg):
        """Update execution reason and msg"""
        self.execution.reason = reason
        self.execution.msg = msg

    def update_results(self, **kwargs):
        """Update execution results"""
        for key, value in kwargs.items():
            if key in self.execution.__dict__:
                setattr(self.execution, key, value)
            else:
                self.report_exit("<runner bug>", "Key {} not found in execution object".format(key))

    def add_similarity(self, sim):
        """Add similarity result to execution result"""
        self.execution.add_similarity(sim)

    def report_exit(self, reason, msg, statuscode=1):
        """Stop execution and give a reason"""
        self.update_reason(reason, msg)
        self.execution.statuscode = statuscode
        raise StopRunException()
