"""julynter run command"""
import json
from .. import util
from ..runner.runner import Runner
from ..runner.compare import NORMALIZATIONS, DEFAULT_NORMALIZATION, DEFAULT_SIMILARITY


def json_view(runner):
    """Display result as json"""
    print(json.dumps(runner, indent=2))


def simple_view(args, runner, spaces=2):
    """Display summarized result as prints"""
    print("{}Status: {}".format(" " * spaces, runner['execution']["status"]))
    print("{}Processed: {}".format(" " * spaces, runner['execution']["processed"]))
    if runner['execution']["status"] == "run":
        select_cells = list(zip(
            range(runner['execution']["executed_cells"]),
            runner['execution']["cell_order"]
        ))
        print("{}  Cells order: {}".format(" " * spaces, ", ".join(
            str(index) for _, index in select_cells
        )))
        print("{}  Duration: {}".format(" " * spaces, runner['execution']["duration"]))
    if runner['fail']['msg']:
        print("{}  Reason: {}".format(" " * spaces, runner['fail']['reason']))
        if not args.hide_message:
            print("{}  Message: {}".format(" " * spaces, runner['fail']['msg']))
    if "finished" in runner["diff"]['processed'] and not args.skip_comparison:
        print("{}  Diff:".format(" " * spaces))
        norms = {x: [] for x in args.normalizations}
        for sim in runner['diff']['similarities']:
            for norm in args.normalizations:
                if not sim.get(norm + '_equals', True):
                    norms[norm].append(str(sim['index']))
        anydiff = False
        for norm in args.normalizations:
            if norms[norm]:
                anydiff = True
                print("{}    {}: {}".format(" " * spaces, norm, ', '.join(norms[norm])))
        if not anydiff:
            print("{}    No diff".format(" " * spaces))


def run(args, _):
    """run operation"""
    util.VERBOSE = args.verbose
    runner = Runner(
        args.path, args.cell_order, args.unsafe,
        args.kernel, args.force_fail, args.timeout,
        args.show_report,
        args.normalizations, args.calculate_similarity,
        args.initial_verbose
    )
    finished_run = runner.run()
    if finished_run and not args.skip_comparison:
        runner.compare()
    if args.output:
        runner.save(args.output)
    dictresult = {
        'fail': runner.fail,
        'execution': runner.result,
        'diff': runner.diff_result
    }
    if args.view_mode in ("ejson", "json"):
        if args.view_mode == "ejson":
            print("<<<<---julyntersep--->>>>")
        json_view(dictresult)
    elif args.view_mode == "simple":
        simple_view(args, dictresult)


def create_subparsers(subparsers):
    """Create subparsers for run command"""
    runparser = subparsers.add_parser(
        'run', help="Run notebook and check if it reproduces the same results"
    )
    runparser.set_defaults(func=run, command=runparser)
    add_run_arguments(runparser)
    runparser.add_argument(
        "path", type=str,
        help="notebook path")

def add_run_arguments(runparser):
    """Add run arguments to parsers"""
    runparser.add_argument(
        "-c", "--cell-order", type=str, default="t", choices=[
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
        "-o", "--output", type=str,
        help="output notebook"
    )
    runparser.add_argument(
        "-x", "--skip-comparison", action="store_true",
        help="do not compare results after execution"
    )
    runparser.add_argument(
        "-i", "--initial-verbose", type=int, default=1,
        help="initial verbose level"
    )
    runparser.add_argument(
        "-w", "--view-mode", type=str, choices=["ejson", "json", "simple"], default="simple",
        help="result visualization mode"
    )
    runparser.add_argument(
        "-m", "--hide-message", action="store_true",
        help="hide error messages"
    )
    
