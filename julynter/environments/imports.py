"""Manipulate notebook imports"""
import ast
import nbformat
from IPython.core.interactiveshell import InteractiveShell

class ImportVisitor(ast.NodeVisitor):
    """Visit cell source and collect imports"""
    # pylint: disable=invalid-name
    def __init__(self):
        self.imports = []
        self.import_from = []
        self.non_toplevel = []
        self.non_toplevel_from = []
        self.level = 0

    def _extract_name(self, names):
        # pylint: disable=no-self-use
        return [x.name for x in names]

    def visit_Import(self, node):
        """Find cell import"""
        lis = (self.imports if self.level <= 1 else self.non_toplevel)
        lis.extend(self._extract_name(node.names))

    def visit_ImportFrom(self, node):
        """Find cell import from"""
        lis = (self.import_from if self.level <= 1 else self.non_toplevel_from)
        lis.append((node.module, self._extract_name(node.names), node.level))

    def generic_visit(self, node):
        self.level += 1
        super().generic_visit(node)
        self.level -= 1

    def import_only_code(self, toplevel):
        """Return cell code with only imports"""
        result = []
        for imp in self.imports:
            result.append("import {}".format(imp))
        for impf in self.import_from:
            name = "." * impf[2] + (impf[0] or "")
            result.append("from {} import {}".format(name, ", ".join(impf[1])))

        if not toplevel:
            for imp in self.non_toplevel:
                result.append("import {}".format(imp))
            for impf in self.non_toplevel_from:
                name = "." * impf[2] + (impf[0] or "")
                result.append("from {} import {}".format(name, ", ".join(impf[1])))
        return "\n".join(result)


def create_notebook_with_imports(path, toplevel=True):
    """Create notebook that only has imports and return path"""
    try:
        with open(path) as fil:
            notebook = nbformat.read(fil, as_version=4)
        metadata = notebook["metadata"]
    except Exception as exc: # pylint: disable=broad-except
        print("Failed to load notebook {}".format(exc))
        return (None, False)
    language_info = metadata.get("language_info", {})
    language = language_info.get("name", "unknown")
    if language == "python":
        shell = InteractiveShell.instance()
        for cell in notebook['cells']:
            if cell.get("cell_type") == "code":
                source = cell["source"] or ""
                cell["source"] = ""
                try:
                    source = shell.input_transformer_manager.transform_cell(source)
                    if "\0" in source:
                        source = source.replace("\0", "\n")
                    tree = ast.parse(source)
                    visitor = ImportVisitor()
                    visitor.visit(tree)
                    cell["source"] = visitor.import_only_code(toplevel)
                except (IndentationError, SyntaxError):
                    pass
        try:
            with open(path + ".julimp", "w") as fil:
                nbformat.write(notebook, fil)
            return (path + ".julimp", True)
        except Exception as exc: # pylint: disable=broad-except
            print("Failed to save notebook {}".format(exc))
            return (None, False)
    return (path, False)
