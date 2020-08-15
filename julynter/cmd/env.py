"""julynter env command"""
import asyncio
import argparse
import os
import sys
from pathlib import Path
from .. import util
from ..environments.docker import DockerEnvironment
from ..environments.conda import CondaEnvironment
from ..environments.venv import VenvEnvironment
from ..environments.orchestrator import EnvironmentOrchestrator
from ..environments.imports import create_notebook_with_imports
from ..cmd.run import simple_view, add_run_arguments
from ..util import do_exit


def discover_files(cwd, values, pattern, exclude=None):
    """Discover files in directory"""
    if "<discover>" not in values:
        return values
    index = values.index("<discover>")
    values.pop(index)
    for name in cwd.glob(pattern):
        name = str(name.relative_to(cwd))
        if exclude and exclude in name:
            continue
        if name not in values:
            values.insert(index, name)
    return values


def create_environment(args, cwd, create, remove):
    """Create environment based on arguments"""
    if args.env_type == "docker":
        volumes = {
            cwd.expanduser().resolve(): args.target_dir,
            Path("~/projects/julynter").expanduser().resolve(): "/home/jul/julynter" # ToDo: remove
        }
        return DockerEnvironment(
            args.image_name, volumes=volumes, cwd=cwd,
            wd=args.target_dir, create=create, remove=remove
        )
    if args.env_type == "conda":
        return CondaEnvironment(
            operation=args.create_operation, conda_path=args.conda_path,
            envname=args.envname, create=create, remove=remove
        )
    #if args.env_type == "venv":
    return VenvEnvironment(
        command=args.create_operation, envname=args.envname,
        create=create, remove=remove
    )


def prepare_files(cwd, args):
    """Discover and preprocess files for running"""
    install = {}
    toremove = []
    notebooks = []

    install = {}
    install['setup.py'] = discover_files(cwd, args.setups, "**/setup.py")
    install['requirements.txt'] = discover_files(cwd, args.requirements, "**/requirements.txt")
    install['Pipfile'] = discover_files(cwd, args.pipfiles, "**/Pipfile")
    install['Pipfile.lock'] = discover_files(cwd, args.pipfile_locks, "**/Pipfile.lock")
    discnotebooks = discover_files(cwd, args.notebooks, "**/*.ipynb", '.ipynb_checkpoints')
    targs = " ".join(args.execution_options or [])
    if args.mode in ("import", "importtop"):
        for path in discnotebooks:
            npath, newfile = create_notebook_with_imports(
                path, toplevel=args.mode == "importtop"
            )
            if npath:
                notebooks.append(npath)
            if newfile:
                toremove.append(npath)
        if "-x" not in targs:
            targs += " -x" # skip-comparison
    elif args.mode == "run":
        notebooks = discnotebooks
    return install, notebooks, targs, toremove


def display_execution_results(res, args, eargs, exitcode):
    """Display execution results"""
    if args.view_mode == "simple":
        print("Report:")
    fails = 0
    skips = 0
    same = 0
    same_norm = 0
    for name, nresult in res["notebooks"].items():
        if args.view_mode == "simple":
            print("  {}".format(name))
            simple_view(eargs, nresult, spaces=4)
        has_error = (
            not nresult.get("execution", None)
            or nresult['execution']['status'] == 'error'
            or 'timeout' in nresult['execution']['processed']
            or 'exception' in nresult['execution']['processed']
            or (
                not eargs.skip_comparison
                and not 'finished' in nresult.get('diff', {}).get('processed', [])
            )
        )
        if has_error:
            exitcode = 3
            fails += 1
        did_skip = (not has_error and (
            'not-run' in nresult['execution']['processed']
            or 'skipped' in nresult['execution']['processed']
        ))
        if did_skip:
            skips += 1

        if not has_error and not did_skip and not eargs.skip_comparison:
            if nresult["diff"]["diff_count"] == 0:
                same += 1
            if nresult["diff"]["diffnorm_count"] == 0:
                same_norm += 1

    print("\nSummary:")
    print("  Total: {} notebooks. Skips: {}; Fails: {}".format(
        len(res['notebooks']), skips, fails
    ))
    if not eargs.skip_comparison:
        print("  Same results before normalizations: {} notebooks".format(same))
        print("  Same results after normalization: {} notebooks".format(same_norm))
    
    return exitcode


def display_results(res, args, eargs):
    """Display general results"""
    fail = res.get('fail', False)
    exitcode = 0
    if fail == 'prepare-env':
        exitcode = 1
        print("Failed to prepare environment")
        print("  Reason: {}".format(res['reason']))
        if not args.hide_message:
            print("  Message: {}".format(res['msg']))
    elif fail == 'install':
        exitcode = 2
        print("Failed to install declared dependencies")
        print("  Reason: {}".format(res['reason']))
        if not args.hide_message:
            print("  Message: {}".format(res['msg']))
    elif fail == 'no-notebooks':
        if args.mode == "prepare":
            print("Environment prepared")
        else:
            print("Failed to run notebooks in a prepared environment: no notebooks")
    elif fail == 'dryrun':
        print("Finished dry-run")
    else:
        exitcode = display_execution_results(res, args, eargs, exitcode)
    return exitcode

async def aenv(args, eargs):
    """run operation"""
    cwd = Path(args.dir)

    remove = args.mode != "prepare"
    envi = create_environment(args, cwd, create=True, remove=remove)

    runner = EnvironmentOrchestrator(
        envi, initial_verbose=args.initial_verbose,
        install_julynter=not args.dont_install_julynter,
        show_output=args.full_outputs
    )
    install, notebooks, targs, toremove = prepare_files(cwd, args)
    exitcode = 0
    try:
        res = await runner.execute_environment(cwd, install, notebooks, targs)
        exitcode = display_results(res, args, eargs)
    finally:
        if not remove:
            envi.report()
        for path in toremove:
            os.remove(path)
    do_exit(exitcode)

def env(args, _):
    """run operation"""
    parser = argparse.ArgumentParser(description='Run notebook arguments')
    add_run_arguments(parser)
    eargs = parser.parse_args(args.execution_options or [])
    eargs.hide_message = args.hide_message
    util.VERBOSE = args.verbose
    if os.name == 'nt':
        loop = asyncio.ProactorEventLoop() # for subprocess' pipes on Windows
        asyncio.set_event_loop(loop)
    else:
        loop = asyncio.get_event_loop()
    loop.run_until_complete(aenv(args, eargs))


def create_subparsers(subparsers):
    """Create subparsers for run command"""
    parser = subparsers.add_parser(
        'env', help="Run notebooks in a custom environment"
    )

    envparser = argparse.ArgumentParser(add_help=False)
    envparser.add_argument(
        'notebooks', type=str, nargs="*", default=["<discover>"],
        help="notebook paths",
    )
    envparser.add_argument(
        '-d', '--dir', type=str, default=os.getcwd(),
        help="base project dir",
    )

    envparser.add_argument(
        "-j", "--dont-install-julynter", action="store_true",
        help="do not install julynter in environment"
    )
    envparser.add_argument(
        "-s", "--setups", type=str, nargs="*", default=["<discover>"],
        help="setup.py paths"
    )
    envparser.add_argument(
        "-r", "--requirements", type=str, nargs="*", default=["<discover>"],
        help="requirements.txt paths"
    )
    envparser.add_argument(
        "-p", "--pipfiles", type=str, nargs="*", default=["<discover>"],
        help="Pipfile paths"
    )
    envparser.add_argument(
        "-l", "--pipfile-locks", type=str, nargs="*", default=["<discover>"],
        help="Pipfile.lock paths"
    )
    envparser.add_argument(
        "-i", "--initial-verbose", type=int, default=0,
        help="initial verbose level"
    )
    envparser.add_argument(
        "-v", "--verbose", type=int, default=-1,
        help="increase output verbosity")
    envparser.add_argument(
        "-o", "--execution-options", nargs=argparse.REMAINDER,
        help="options for 'julynter run' command")
    envparser.add_argument(
        "-m", "--hide-message", action="store_true",
        help="hide error messages"
    )
    envparser.add_argument(
        "-f", "--full-outputs", action="store_true",
        help="display output of subprocesses"
    )
    envparser.add_argument(
        "-w", "--view-mode", type=str, choices=["simple", "summary"], default="simple",
        help="result visualization mode"
    )

    parser.add_argument(
        "mode", choices=["run", "prepare", "import", "importtop"],
        help="execution modes"
    )
    subp = parser.add_subparsers()


    docker = subp.add_parser(
        'docker', parents=[envparser],
        help="use docker environment"
    )
    docker.set_defaults(env_type="docker")

    docker.add_argument(
        '-e', '--image-name', type=str, default="python",
        help="image name"
    )
    docker.add_argument(
        '-t', '--target-dir', type=str, default="/home/jul/execution",
        help="target execution dir"
    )

    conda = subp.add_parser(
        'conda', parents=[envparser],
        help='use conda environment'
    )
    conda.set_defaults(env_type="conda")
    conda.add_argument(
        '-e', '--envname', type=str, default="julynterwork",
        help="target environment name"
    )
    conda.add_argument(
        '-a', '--conda-path', type=str, default="~/anaconda3",
        help="conda base path"
    )
    conda.add_argument(
        '-c', '--create-operation', type=str, default="python={}.{}".format(*sys.version_info),
        help="create command arguments. "
        "You may set it as '--clone base' if you want to clone an existing environment"
    )

    venv = subp.add_parser(
        'venv', parents=[envparser],
        help='use venv environment'
    )
    venv.set_defaults(env_type="venv")
    venv.add_argument(
        '-e', '--envname', type=str, default=".julynterwork",
        help="target venv name"
    )
    venv.add_argument(
        '-c', '--create-operation', type=str, default="python -m venv",
        help="create venv command. "
        "You may set it 'virtualenv venv --python=python{}.{}'".format(*sys.version_info)
    )

    parser.set_defaults(func=env, command=envparser)
