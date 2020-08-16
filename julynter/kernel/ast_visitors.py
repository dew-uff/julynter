"""Visit node ast collecting information"""
import ast
import os

class JulynterImportVisitor(ast.NodeVisitor):
    """Collect import names"""
    # pylint: disable=invalid-name

    def __init__(self):
        self.imports = []

    def visit_Import(self, node):
        """Visit Import Node"""
        for alias in node.names:
            self.imports.append(alias.name.split('.')[0])

    def visit_ImportFrom(self, node):
        """Visit ImportFrom Node"""
        if node.module and not node.level:
            self.imports.append(node.module.split('.')[0])


class JulynterNameVisitor(ast.NodeVisitor):
    """Collect name definitions and usages"""
    # pylint: disable=invalid-name

    def __init__(self):
        self.name_definitions = set()
        self.name_usages = set()
        self.import_definition = set()

    def visit_Import(self, node):
        """Visit Import Node"""
        for alias in node.names:
            self.name_definitions.add(alias.asname or alias.name.split('.')[0])
            self.import_definition.add(alias.asname or alias.name.split('.')[0])

    def visit_ImportFrom(self, node):
        """Visit ImportFrom Node"""
        for alias in node.names:
            self.name_definitions.add(alias.asname or alias.name.split('.')[0])
            self.import_definition.add(alias.asname or alias.name.split('.')[0])

    def visit_Name(self, node):
        """Visit Name Node"""
        if isinstance(node.ctx, (ast.Param, ast.Store)):
            self.name_definitions.add(node.id)
        else:
            self.name_usages.add(node.id)

    def visit_FunctionDef(self, node):
        """Visit FunctionDef Node"""
        self.name_definitions.add(node.name)

    def visit_ClassDef(self, node):
        """Visit ClassDef Node"""
        self.name_definitions.add(node.name)

    def visit_arg(self, node):
        """Visit arg Node"""
        self.name_definitions.add(node.arg)


class JulynterPathVisitor(ast.NodeVisitor):
    """Collect absolute paths"""
    # pylint: disable=invalid-name

    def __init__(self):
        self.absolute_paths = set()

    def visit_Str(self, node):
        """Visit Str Node"""
        if os.path.abspath(node.s) == node.s and os.path.exists(node.s) and node.s != '/':
            self.absolute_paths.add(node.s)
