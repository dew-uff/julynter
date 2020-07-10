import re
import pkg_resources
import os
from jupyterlab import labapp, labextensions
from jupyterlab.commands import install_extension, build


RESOURCE_NAME = 'julynter'
PACKAGE_NAME = 'julynter-labextension-{}.tgz'
PACKAGE_RE = re.compile('^' + PACKAGE_NAME.format('(.*)\\'))


def version_tuple(version):
    parts = version.split('.')
    return tuple(int(x) if x.isnumeric() else x for x in parts)


def install_cmd(args, rest):
    files = pkg_resources.resource_listdir(RESOURCE_NAME, 'labextension')
    versions = [version_tuple(PACKAGE_RE.sub(r'\1', x)) for x in files]
    latest = max(versions)
    latest_file = PACKAGE_NAME.format('.'.join(map(str, latest)))
    resource_file = pkg_resources.resource_filename(RESOURCE_NAME, 'labextension/' + latest_file)
    print('Installing labextension')
    install_extension(resource_file)
    build()


def lab_cmd(args, rest):
    path = pkg_resources.resource_filename(RESOURCE_NAME, 'julynterlab')
    os.environ['JUPYTERLAB_DIR'] = path
    labapp.LabApp.app_dir = os.environ['JUPYTERLAB_DIR']
    labapp.LabApp.launch_instance(argv=rest)


def labextension_cmd(args, rest):
    path = pkg_resources.resource_filename(RESOURCE_NAME, 'julynterlab')
    os.environ['JUPYTERLAB_DIR'] = path
    labextensions.BaseExtensionApp.app_dir = os.environ['JUPYTERLAB_DIR']
    labextensions.LabExtensionApp.launch_instance(argv=rest)


def create_subparsers(subparsers):
    ins_parser = subparsers.add_parser(
        'install',
        help="Use nodejs to install the labextension"
    )
    ins_parser.set_defaults(func=install_cmd, command=ins_parser)

    lab_parser = subparsers.add_parser(
        'lab', add_help=False,
        help="Start Jupyter Lab with Julynter"
    )
    lab_parser.set_defaults(func=lab_cmd, command=lab_parser)

    ext_parser = subparsers.add_parser(
        'labextension', add_help=False,
        help="Run Jupyter labextension from Julynter"
    )
    ext_parser.set_defaults(func=labextension_cmd, command=ext_parser)
