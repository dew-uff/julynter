"""Define execution order"""
# pylint: disable=abstract-method, attribute-defined-outside-init, no-member
from nbconvert.preprocessors import ExecutePreprocessor, Preprocessor

from ..util import vprint


class UnsafePreprocessor(Preprocessor):
    """Run cells following the order specified in cell_order. Define the last_try"""

    def safety_fix(self, notebook, index):
        """Fix cell code to run it safer"""

    def preprocess(self, nb, resources):
        for order, index in enumerate(self.cell_order):
            vprint(self.vindex, "{}- Running cell {}".format(order, index))
            self.safety_fix(nb, index)
            self.last_try = (order, index)
            nb.cells[index], resources = self.preprocess_cell(
                nb.cells[index], resources, index
            )
        return nb, resources


class SafePreprocessor(UnsafePreprocessor):
    """Replace unsafe commands from cell"""

    def safety_fix(self, notebook, index):
        has_kill = (
            notebook.cells[index].get('cell_type', '') == 'code'
            and '!kill -9 -1' in notebook.cells[index].get('source', '')
        )
        if has_kill:
            notebook.cells[index]['source'] = (
                notebook.cells[index]['source']
                .replace('!kill -9 -1', '')
            )


class TopBottomAllCellsPreprocessor(Preprocessor):
    """Run all cells in TopDown order"""

    def prepare_notebook_order(self, notebook, vindex):
        """Define the execution of all cells"""
        self.vindex = vindex
        self.cell_order = list(range(len(notebook.cells)))
        return ""


class TopBottomPreprocessor(Preprocessor):
    """Run cells with execution count in TopDown order"""

    def prepare_notebook_order(self, notebook, vindex):
        """Define the execution of cells with execution count"""
        self.vindex = vindex
        cells = [
            index for index, cell in enumerate(notebook.cells)
            if isinstance(cell.get(u'execution_count'), int)
        ]
        self.cell_order = cells
        if not cells:
            return u"No numbered cells"
        return ""


class ExecutionCountPreprocessor(Preprocessor):
    """Run cells following the execution count"""

    def prepare_notebook_order(self, notebook, vindex):
        """Define the execution of cells following the execution count"""
        self.vindex = vindex
        self.cell_order = []
        cells = sorted([
            (int(cell.get(u'execution_count')), index, cell)
            for index, cell in enumerate(notebook.cells)
            if isinstance(cell.get(u'execution_count'), int)
        ])
        if not cells:
            return u"No numbered cells"

        numbers = {count for count, _, _ in cells}
        if len(numbers) != len(cells):
            return u"Repeated cell numbers"

        self.cell_order = [index for _, index, _ in cells]
        return ""


def create_preprocessor(order, unsafe, vindex):
    """Create preprocessor class based on the execution order and safeness"""
    # pylint: disable=too-many-ancestors
    if order.lower() in ("a", "all", "0"):
        vprint(vindex, "TopDown Order - All cells")
        middle = TopBottomAllCellsPreprocessor
    elif order.lower() in ("e", "ec", "executioncount", "1"):
        vprint(vindex, "ExecutionCount Order")
        middle = ExecutionCountPreprocessor
    else: #order.lower() in ("t", "topdown", "td", "2"):
        vprint(vindex, "TopDown Order")
        middle = TopBottomPreprocessor
    last = UnsafePreprocessor if unsafe else SafePreprocessor
    class NotebookPreprocessor(ExecutePreprocessor, middle, last):
        """Resulting preprocessor"""
    return NotebookPreprocessor
