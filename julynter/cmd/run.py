"""julynter run command"""
from .. import util
from ..runner.runner import Runner
from ..runner.compare import NORMALIZATIONS, DEFAULT_NORMALIZATION, DEFAULT_SIMILARITY


def run(args, _):
    """run operation"""
    util.VERBOSE = args.verbose
    print(args.normalizations)
    runner = Runner(
        args.path, args.order, args.unsafe,
        args.kernel, args.force_fail, args.timeout,
        args.show_report,
        args.normalizations, args.calculate_similarity
    )
    runner.run()


def create_subparsers(subparsers):
    """Create subparsers for run command"""
    runparser = subparsers.add_parser(
        'run', help="Run notebook and check if it reproduces the same results"
    )
    runparser.set_defaults(func=run, command=runparser)
    runparser.add_argument(
        "-o", "--order", type=str, default="t", choices=[
            '0', 'a', 'all',
            '1', 'e', 'ec', 'executioncount',
            '2', 't', 'td', 'topdown'
        ],
        help=(
            "cell execution order: "
            "'a' - top down, all cells; "
            "'t' - top down, cells with execution count; "
            "'e' - execution count order"
        )
    )
    runparser.add_argument(
        "-u", "--unsafe", action="store_false",
        help="disable filtering some unsafe code")
    runparser.add_argument(
        "-v", "--verbose", type=int, default=-1,
        help="increase output verbosity")
    runparser.add_argument(
        "-k", "--kernel", type=str,
        help="specify Jupyter kernel. By default it tries to read from the notebook"
    )
    runparser.add_argument(
        "-f", "--force-fail", action="store_true",
        help="do not fallback to the default behavior on invalid parameters"
    )
    runparser.add_argument(
        "-r", "--show-report", action="store_true",
        help="show mismatch report"
    )
    runparser.add_argument(
        "-t", "--timeout", type=float, default=300,
        help="notebook timeout time (in seconds)")
    runparser.add_argument(
        "-n", "--normalizations", nargs="+", choices=NORMALIZATIONS.keys(),
        default=DEFAULT_NORMALIZATION,
        help="normalization order"
    )
    runparser.add_argument(
        "-s", "--calculate-similarity", nargs="+", choices=NORMALIZATIONS.keys(),
        default=DEFAULT_SIMILARITY,
        help="calculate post-normalization similarity"
    )

    runparser.add_argument(
        "path", type=str,
        help="notebook path")
