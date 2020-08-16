"""Define main julynter checks"""
import ast
import os
import sys
import re
import builtins
import traceback
from collections import defaultdict
from copy import copy
import pkg_resources

from .ast_visitors import JulynterImportVisitor, JulynterNameVisitor, JulynterPathVisitor
from .jcomm import JulynterComm


def _julynter_get_package(module_name):
    if module_name not in sys.modules:
        return (2, 'Module {} not imported'.format(module_name))
    module = sys.modules[module_name]
    if not hasattr(module, '__file__'):
        return (0, 'Builtin module')
    package_matches = re.findall('site-packages/(.*?)/', module.__file__)
    if not package_matches:
        return (1, 'Package not found')
    return (-1, package_matches[0])


def _julynter_check_package_version(module_name, requirements):
    status, msg = _julynter_get_package(module_name)
    if status != -1:
        return (status, msg)
    package = msg
    found = None
    if not os.path.exists(requirements):
        return (3, "requirements.txt doesn't exist")
    with open(requirements, 'r') as fil:
        for line in fil:
            if line.strip().startswith(package):
                found = line
                break
    if found is None:
        return (3, 'Module not found on requirements.txt')
    try:
        distribution = pkg_resources.get_distribution(package)
    except pkg_resources.DistributionNotFound:
        return (1, 'Distribution not found')
    version = distribution.version
    req_version = found.strip().split('==')[-1]
    if version != req_version:
        return (3, 'Version mismatch')
    return (0, 'Ok')


class JulynterKernel(JulynterComm):
    """Implements julynter checks"""

    def __init__(self, *args, **kwargs):
        super(JulynterKernel).__init__(*args, **kwargs)
        self.history = self.shell.history_manager
        self.cache = {
            'lineno_order': [],
            'python_trees': {},
            'processed': set(),
            'name_definitions': {},
            'import_definitions': {},
            'name_usages': {},
            'cell_dependencies': defaultdict(dict),
            'missing_dependencies': {},

            'last_requirements': '',
            'requirements_checked': {},
            'missing_requirements': defaultdict(dict),
            'requirements_processed': set(),
            'has_imports': [],
        }

    def receive(self, msg):
        data = msg['content']['data']
        operation = data.get('operation', '<undefined>')
        try:
            if operation == 'query':
                req = data.get('requirements', 'requirements.txt')
                self.send(self.julynter_query(req))
            elif operation == 'addModule':
                req = data.get('requirements', 'requirements.txt')
                module = data.get('module', '<undefined>')
                result = self.add_package_to_requirements(module, req)
                if result[0] <= 0:
                    self.send(self.julynter_query(req))
                else:
                    self.send({
                        'operation': 'error',
                        'command': operation,
                        'message': result[1],
                        'errorid': result[0],
                    })
        except Exception:  # pylint: disable=broad-except
            self.send({
                'operation': 'error',
                'command': operation,
                'message': traceback.format_exc()
            })

    def julynter_query(self, requirements_file='requirements.txt'):
        """Extract info from history"""
        self._parse_cell_trees()
        cell_dependencies, missing_dependencies = self._julynter_dependencies()
        has_imports, missing_requirements = self._julynter_imports(requirements_file)
        result = {
            'operation': 'queryResult',
            'executed_code': self._julynter_history(),
            'cell_dependencies': cell_dependencies,
            'missing_dependencies': missing_dependencies,
            'absolute_paths': self._julynter_absolute_paths(),
            'has_imports': has_imports,
            'missing_requirements': missing_requirements,
        }
        return result

    def _parse_cell_trees(self):
        """Parse python cell trees"""
        python_trees = self.cache['python_trees']
        lineno_order = self.cache['lineno_order']
        lineno_order.clear()
        rang = self.history.get_range(raw=False, output=False)
        for _, lineno, inline in rang:
            lineno_order.append(lineno)
            if lineno in python_trees:
                continue
            if inline.startswith("get_ipython().run_cell_magic(\'time\'"):
                inline = inline[42:-2].encode('utf-8').decode('unicode_escape')
            try:
                python_trees[lineno] = ast.parse(inline)
            except SyntaxError:
                python_trees[lineno] = None

    def _name_was_defined_before(self, usage, lineno):
        """Check if name was defined before lineno"""
        name_definitions = self.cache['name_definitions']
        for _, line, _ in reversed(list(self.history.get_range(stop=lineno + 1))):
            if usage in name_definitions.get(line, []):
                return (True, line)
        is_builtin = (
            usage in {'_', '__', '___', '_sh', 'Out', 'In', 'get_ipython'}
            or usage in self.shell.ns_table
            or usage in builtins.__dict__
        )
        return (is_builtin, None)

    def _julynter_dependencies(self):
        """Find dependencies among name usages and definitions"""
        processed = self.cache['processed']
        cell_dependencies = self.cache['cell_dependencies']
        missing_dependencies = self.cache['missing_dependencies']
        import_definitions = self.cache['import_definitions']
        python_trees = self.cache['python_trees']
        lineno_order = self.cache['lineno_order']

        for lineno in lineno_order:
            tree = python_trees.get(lineno, None)
            if lineno in processed or tree is None:
                continue
            processed.add(lineno)
            name_visitor = JulynterNameVisitor()
            name_visitor.visit(tree)
            self.cache['name_definitions'][lineno] = name_visitor.name_definitions
            self.cache['name_usages'][lineno] = name_visitor.name_usages
            import_definitions[lineno] = name_visitor.import_definition
            missing_dependencies[lineno] = []
            for usage in name_visitor.name_usages:
                found, line = self._name_was_defined_before(usage, lineno)
                create_dependency = (
                    found and line is not None
                    and line != lineno and usage not in import_definitions.get(line, [])
                )
                if create_dependency:
                    cell_dependencies[lineno][usage] = line
                if not found:
                    missing_dependencies[lineno].append(usage)
        return cell_dependencies, missing_dependencies

    def _reset_import_cache(self, requirements_file):
        """Reset import cache"""
        self.cache['last_requirements'] = requirements_file
        self.cache['requirements_checked'].clear()
        self.cache['missing_requirements'].clear()
        self.cache['requirements_processed'].clear()
        self.cache['has_imports'].clear()

    def _check_imports(self, imports, lineno, requirements_file):
        """Check imports of a cell in requirements_file"""
        checked = self.cache['requirements_checked']
        missing_requirements = self.cache['missing_requirements']

        for req in imports:
            if checked.get(req, 5) >= 2:
                status, msg = _julynter_check_package_version(req, requirements_file)
                if status >= 2:
                    missing_requirements[lineno][req] = {
                        'status': status,
                        'msg': msg
                    }
                checked[req] = status

    def _julynter_imports(self, requirements_file):
        """Check imports from all cells"""
        missing_requirements = self.cache['missing_requirements']
        processed = self.cache['requirements_processed']
        has_imports = self.cache['has_imports']
        python_trees = self.cache['python_trees']
        lineno_order = self.cache['lineno_order']
        if requirements_file != self.cache['last_requirements']:
            self._reset_import_cache(requirements_file)

        old_missing = copy(missing_requirements)
        missing_requirements.clear()
        # check if old imports are still missing
        for lineno, requirements in old_missing.items():
            self._check_imports(requirements.keys(), lineno, requirements_file)
        # check new imports
        for lineno in lineno_order:
            tree = python_trees.get(lineno, None)
            if lineno in processed or tree is None:
                continue
            processed.add(lineno)
            import_visitor = JulynterImportVisitor()
            import_visitor.visit(tree)
            if import_visitor.imports:
                has_imports.append(lineno)
            self._check_imports(import_visitor.imports, lineno, requirements_file)
        return has_imports, missing_requirements

    def _julynter_history(self):
        """Return dict of executed code by line number"""
        executed_code = {}
        for _, lineno, inline in self.history.get_range(raw=True, output=False):
            executed_code[lineno] = inline
        return executed_code

    def _julynter_absolute_paths(self):
        """Check the existence of absolute paths"""
        python_trees = self.cache['python_trees']
        lineno_order = self.cache['lineno_order']
        absolute_paths = {}
        for lineno in lineno_order:
            tree = python_trees.get(lineno, None)
            if tree is None:
                continue
            path_visitor = JulynterPathVisitor()
            path_visitor.visit(tree)
            if path_visitor.absolute_paths:
                absolute_paths[lineno] = list(path_visitor.absolute_paths)
        return absolute_paths

    def add_package_to_requirements(self, module_name, requirements):
        """Add module to requirements.txt file"""
        # pylint: disable=no-self-use
        module_name = module_name.strip()
        status, msg = _julynter_get_package(module_name)
        if status != -1:
            return (status, msg)
        package = msg
        try:
            distribution = pkg_resources.get_distribution(package)
            version = '=={}'.format(distribution.version)
        except pkg_resources.DistributionNotFound:
            version = ''
        lines = []
        found = False
        if os.path.exists(requirements):
            with open(requirements, 'r') as fil:
                for line in fil:
                    if line.strip().startswith(package):
                        lines.append('{}{}\n'.format(package, version))
                        found = True
                    else:
                        lines.append(line)
        if not found:
            lines.append('{}{}\n'.format(package, version))
        with open(requirements, 'w') as fil:
            fil.writelines(lines)
        return (status, msg)
