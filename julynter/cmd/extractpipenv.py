"""julynter extract pipenv command"""
import sys
import subprocess
import os
from .. import util
from ..util import do_exit


def extract(args, _):
    """extract pipenv operation"""
    cwd = util.Path(args.path)
    parent = cwd.parents[0]
    requirements_txt = parent / args.output
    with open(str(requirements_txt), "wb") as outf:
        env = dict(os.environ)
        env["GIT_TERMINAL_PROMPT"] = "0"
        result = subprocess.run(
            ["pipenv", "lock", "-r", "--python", sys.executable],
            stdout=outf, cwd=str(parent), env=env, check=False)
        if result.stderr:
            sys.stderr.write(result.stderr)
    do_exit(result.returncode)


def create_subparsers(subparsers):
    """Create subparsers for run command"""
    parser = subparsers.add_parser(
        'extractpipenv', help="Run notebook and check if it reproduces the same results"
    )
    parser.set_defaults(func=extract, command=parser)
    parser.add_argument("-p", "--path", type=str, default="Pipfile.lock",
                        help="pipenv path")
    parser.add_argument("-o", "--output", type=str, default="_julynter_requirements.txt",
                        help="requirements output")
