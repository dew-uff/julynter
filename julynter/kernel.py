import json, ast, os, sys, pkg_resources, re, builtins
from collections import defaultdict


class _JulynterImportVisitor(ast.NodeVisitor):
    def __init__(self):
        self.imports = []
    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append(alias.name.split('.')[0])
    def visit_ImportFrom(self, node):
        if node.module and not node.level:
            self.imports.append(node.module.split('.')[0])


class _JulynterNameVisitor(ast.NodeVisitor):
    def __init__(self):
        self.name_definitions = set()
        self.name_usages = set()
    def visit_Import(self, node):
        for alias in node.names:
            self.name_definitions.add(alias.asname or alias.name.split('.')[0])
    def visit_ImportFrom(self, node):
        for alias in node.names:
            self.name_definitions.add(alias.asname or alias.name.split('.')[0])
    def visit_Name(self, node):
        if isinstance(node.ctx, (ast.Param, ast.Store)):
            self.name_definitions.add(node.id)
        else:
            self.name_usages.add(node.id)
    def visit_FunctionDef(self, node):
        self.name_definitions.add(node.name)
    def visit_ClassDef(self, node):
        self.name_definitions.add(node.name)
    def visit_arg(self, node):
        self.name_definitions.add(node.arg)


class _JulynterPathVisitor(ast.NodeVisitor):    
    def __init__(self):
        self.absolute_paths = set()
    def visit_Str(self, node):
        if os.path.abspath(node.s) == node.s and os.path.exists(node.s) and node.s != '/':
            self.absolute_paths.add(node.s)


_julynter_dependencies_processed = set()
_julynter_name_definitions = {}
_julynter_name_usages = {}
_julynter_cell_dependencies = defaultdict(dict)
_julynter_missing_dependencies = {}


def _julynter_dependencies(ip, hm):
    processed = _julynter_dependencies_processed
    name_definitions = _julynter_name_definitions
    name_usages = _julynter_name_usages
    cell_dependencies = _julynter_cell_dependencies
    missing_dependencies = _julynter_missing_dependencies
    for i, (session, lineno, inline) in enumerate(hm.get_range(raw=False, output=False)):
        if lineno in processed:
            continue
        if inline.startswith("get_ipython().run_cell_magic(\\'time\\'"):
            inline = inline[42:-2].encode('utf-8').decode('unicode_escape')
        processed.add(lineno)
        tree = ast.parse(inline)
        name_visitor = _JulynterNameVisitor()
        name_visitor.visit(tree)
        name_definitions[lineno] = name_visitor.name_definitions
        name_usages[lineno] = name_visitor.name_usages
        missing_dependencies[lineno] = []
        for usage in name_visitor.name_usages:
            found = False
            for _, line, _ in reversed(list(hm.get_range(stop=lineno + 1))):
                if usage in name_definitions.get(line, []):
                    found = True
                    if line != lineno:
                        cell_dependencies[lineno][usage] = line
                    break
            if (
                not found
                and usage not in {'_', '__', '___', '_sh', 'Out', 'In', 'get_ipython'}
                and usage not in ip.ns_table
                and usage not in builtins.__dict__
            ):
                missing_dependencies[lineno].append(usage)
    return cell_dependencies, missing_dependencies


def _julynter_history(ip, hm):
    executed_code = {}
    for session, lineno, inline in hm.get_range(raw=True, output=False):
        executed_code[lineno] = inline
    return executed_code


def _julynter_absolute_paths(ip, hm):
    absolute_paths = {}
    for session, lineno, inline in hm.get_range(raw=False, output=False):
        path_visitor = _JulynterPathVisitor()
        tree = ast.parse(inline)
        path_visitor.visit(tree)
        if path_visitor.absolute_paths:
            absolute_paths[lineno] = list(path_visitor.absolute_paths)
    return absolute_paths


_julynter_missing_requirements = defaultdict(dict)
_julynter_requirements_checked = {}
_julynter_has_imports = []
_julynter_requirements_processed = set()
_last_requirements_file = ['']


def _julynter_get_package(module_name):
    if module_name not in sys.modules:
        return (2, 'Module not imported')
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
    with open(requirements, 'r') as f:
        for line in f:
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


def _julynter_imports(ip, hm, requirements_file):
    if requirements_file != _last_requirements_file[0]:
        _last_requirements_file[0] = requirements_file
        _julynter_requirements_checked.clear()
        _julynter_missing_requirements.clear()
        _julynter_requirements_processed.clear()
        _julynter_has_imports.clear()
    has_imports = _julynter_has_imports
    processed = _julynter_requirements_processed
    old_missing = {k: v for k, v in _julynter_missing_requirements.items()}
    missing_requirements = _julynter_missing_requirements
    missing_requirements.clear()
    checked = _julynter_requirements_checked
    for lineno, requirements in old_missing.items():
        for req, _ in requirements.items():
            if checked.get(req, 5) >= 2:
                status, msg = _julynter_check_package_version(req, requirements_file)
                if status >= 2:
                    missing_requirements[lineno][req] = {
                        'status': status,
                        'msg': msg
                    }
                checked[req] = status
    for session, lineno, inline in hm.get_range(raw=False, output=False):
        if lineno in processed:
            continue
        processed.add(lineno)
        tree = ast.parse(inline)
        import_visitor = _JulynterImportVisitor()
        import_visitor.visit(tree)
        if import_visitor.imports:
            has_imports.append(lineno)
        for req in import_visitor.imports:
            if checked.get(req, 5) >= 2:
                status, msg = _julynter_check_package_version(req, requirements_file)
                if status >= 2:
                    missing_requirements[lineno][req] = {
                        'status': status,
                        'msg': msg
                    }
                checked[req] = status
    return has_imports, missing_requirements


def _jupyterlab_julynter_query(requirements_file='requirements.txt'):
    ip = get_ipython()
    hm = ip.history_manager
    cell_dependencies, missing_dependencies = _julynter_dependencies(ip, hm)
    has_imports, missing_requirements = _julynter_imports(ip, hm, requirements_file)
    result = {
        'julynter_result': 'julynter.kernel._jupyterlab_julynter',
        'executed_code': _julynter_history(ip, hm),
        'cell_dependencies': cell_dependencies,
        'missing_dependencies': missing_dependencies,
        'absolute_paths': _julynter_absolute_paths(ip, hm),
        'has_imports': has_imports,
        'missing_requirements': missing_requirements,
    }
    return json.dumps(result, ensure_ascii=False)


def _jupyterlab_julynter_add_package_to_requirements(module_name, requirements):
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
        with open(requirements, 'r') as f:
            for line in f:
                if line.strip().startswith(package):
                    lines.append('{}{}\\n'.format(package, version))
                    found = True
                else:
                    lines.append(line)
    if not found:
        lines.append('{}{}\\n'.format(package, version))
    with open(requirements, 'w') as f:
        f.writelines(lines)
    return _jupyterlab_julynter_query(requirements)

print('ok-initialized')