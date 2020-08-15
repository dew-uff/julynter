"""julynter validate command"""
import sys
import nbformat
from .. import util
from ..util import vprint, do_exit

GROUP_ATTR = {
    'type': 'reportType',
    'cell': 'cellId'
}

GROUP_MAP = {
    'invalidtitle': 'Invalid Title',
    'hiddenstate': 'Hidden State',
    'confusenotebook': 'Confuse Notebook',
    'import': 'Import',
    'absolutepath': 'Absolute Path'
}


def filter_groups(lint_list):
    """Remove lints"""
    return [x for x in lint_list if x['cellId'] != 'group']


def order_by_type(element):
    """Return ordering for Lint IReport"""
    return (
        element['reportType'],
        element['reportId'],
        element['cellId'],
    )

def order_by_cell(element):
    """Return ordering for Lint IReport"""
    return (
        element['cellId'],
        element['reportType'],
        element['reportId'],
    )


def display_lint(report, extra="", suggestion=True, reason=True):
    """Display lint"""
    vprint(0, "{}{} - {}".format(extra, report['reportId'], report['text']))
    if reason:
        vprint(0, "{}  Reason: {}".format(extra, report['reason']))
    if suggestion:
        vprint(0, "{}  Suggestion: {}".format(extra, report['suggestion']))


def prepare_visible_and_hidden(args, results):
    """Prepare lists of lints and hidden lints"""
    visible = filter_groups(results.get('visible', []))
    filtered_id = filter_groups(results.get('filteredId', []))
    filtered_individual = filter_groups(results.get('filteredIndividual', []))
    filtered_restart = filter_groups(results.get('filteredRestart', []))
    filtered_type = filter_groups(results.get('filteredType', []))
    lints = []
    hidden = []
    (lints if not args.hide_visible else hidden).extend(visible)
    (lints if args.filtered_lint else hidden).extend(filtered_id)
    (lints if args.filtered_message else hidden).extend(filtered_individual)
    (lints if args.filtered_restart else hidden).extend(filtered_restart)
    (lints if args.filtered_type else hidden).extend(filtered_type)
    return lints, hidden


def validate(args, _):
    """Validate notebook"""
    util.VERBOSE = args.verbose
    try:
        with open(args.path) as fil:
            notebook = nbformat.read(fil, as_version=4)
        metadata = notebook["metadata"]
    except Exception as exc: # pylint: disable=broad-except
        vprint(-1, "Failed to load notebook {}".format(exc))
        do_exit(3)

    if 'julynter-results' not in metadata:
        vprint(-1, 'Not valid! You must lint the notebook inside'
                   ' Jupyter Lab before validating it.')
        do_exit(2)

    results = metadata['julynter-results']
    lints, hidden = prepare_visible_and_hidden(args, results)
    exitcode = 0
    if lints:
        lastgroup = None
        usegroup = GROUP_ATTR[args.group] if args.group != "no" else None
        extra = "  " if usegroup else ""
        for lint in lints:
            if usegroup and lint[usegroup] != lastgroup:
                gname = lint[usegroup]
                if lastgroup is not None:
                    vprint(0, "")
                lastgroup = gname
                vprint(0, "{}".format(GROUP_MAP.get(gname, gname)))
            display_lint(
                lint, extra,
                suggestion=not args.hide_explanation,
                reason=not args.hide_explanation,
            )
        vprint(0, "")
        vprint(-1, 'Not valid! Found {} lints'.format(len(lints)))
        exitcode = 1
    else:
        vprint(-1, 'Valid notebook!')

    if hidden and not args.hide_warning:
        current = current_filter_letters(args)
        vprint(-1, '\nWARNING: Found {} hidden lints'.format(len(hidden)))
        vprint(-1, '  Please run "julynter validate -trim <notebook>" to show all hidden lints')
        vprint(-1, '  Or "julynter validate -w{} <notebook>" to hide this warning'.format(current))

    do_exit(exitcode)


def current_filter_letters(args):
    """Return current filter letters"""
    current = ""
    if args.filtered_type:
        current += "t"
    if args.filtered_restart:
        current += "r"
    if args.filtered_lint:
        current += "i"
    if args.filtered_message:
        current += "m"
    if args.hide_visible:
        current += "d"
    return current


def create_subparsers(subparsers):
    """Create subparsers for validate command"""
    parser = subparsers.add_parser(
        'validate', help=(
            "validate notebook and show existing lints. "
            "It will NOT lint the notebook. "
            "You must use Jupyter Lab instead"
        )
    )
    parser.set_defaults(func=validate, command=parser)
    parser.add_argument(
        "path", type=str,
        help="notebook path")
    parser.add_argument(
        '-i', '--filtered-lint', action="store_true",
        help="Show filtered lint id categories"
    )
    parser.add_argument(
        '-m', '--filtered-message', action="store_true",
        help="Show filtered individual lint messages"
    )
    parser.add_argument(
        '-r', '--filtered-restart', action="store_true",
        help="Show filtered lints that require restarts"
    )
    parser.add_argument(
        '-t', '--filtered-type', action="store_true",
        help="Show filtered lint types"
    )
    parser.add_argument(
        '-d', '--hide-visible', action="store_true",
        help="Ignore visible lints"
    )
    parser.add_argument(
        '-w', '--hide-warning', action="store_true",
        help="Hide warning about hidden lints"
    )
    parser.add_argument(
        '-v', '--verbose', type=int, default=0,
        help="Verbosity level. 0 shows status; 1 shows lints"
    )
    parser.add_argument(
        '-g', '--group', choices=['no', 'type', 'cell'], default='type',
        help="Group lints. Requires -v 1"
    )
    parser.add_argument(
        '-e', '--hide-explanation', action="store_true",
        help="Hide explanation that appear for lints with -v 1"
    )
