import zipfile
import os
from datetime import datetime
from ..config import load_home_config, save_home_config, home_config_path
from ..config import DEFAULT_EXPERIMENT_SERVER
from ..util import log
from pathlib import Path


def base_experiment_cmd(args, rest):
    if not getattr(args, 'expfunc', None):
        args.command.print_help()
    else:
        args.expfunc(args, rest)


def non_empty(value, question, keep=None):
    if value != "<ask>":
        if value:
            return value
        if keep is not None:
            return keep
    elif keep is None:
        return value
    while True:
        value = input("=> " + question + "\n")
        check_value = value.strip()
        if check_value:
            return value
        else:
            print("Please write a non-empty value")


def validate_yes_no(value):
    if isinstance(value, bool):
        return value
    if value is None or value == "<ask>":
        return value
    check_value = value.strip().lower()
    if check_value in ("", "y", "yes", "t", "true", "1"):
        return True
    elif check_value in ("n", "no", "f", "false", "0"):
        return False


def yes_no(value, question, keep=None):
    if value != "<ask>":
        if value is not None:
            return value
        if keep is not None:
            return keep
    else:
        if keep is None:
            return True

    while True:
        value = input("=> " + question + " [Y/n] ")
        check_value = validate_yes_no(value)
        if check_value is not None:
            if value.strip() == "":
                print("Using default (yes)")
            return check_value
        else:
            print("Please respond with 'yes' or 'no'")
        

def start_experiment_cmd(args, rest):
    data = load_home_config()
    experiment = data["experiment"]
    experiment["id"] = non_empty(
        args.id,
        "What is your participant ID?",
        experiment["id"] if args.keep else None
    )
    experiment["lintingMessage"] = yes_no(
        args.linting_messages,
        "Can we collect linting messages that appear for you?",
        experiment["lintingMessage"] if args.keep else None
    )
    if experiment["lintingMessage"]:
        experiment["lintingTypes"] = True
    else:
        experiment["lintingTypes"] = yes_no(
            args.linting_types,
            "Can we collect the types of linting messages?",
            experiment["lintingTypes"] if args.keep else None
        )
    experiment["activity"] = yes_no(
        args.activity,
        "Can we collect activity information (i.e., Julynter filters, notebook opening and closing)?",
        experiment["activity"] if args.keep else None
    )
    experiment["execution"] = yes_no(
        args.execution,
        "Can we collect execution information (i.e., size of executed cells, type of execution output)?",
        experiment["execution"] if args.keep else None
    )
    experiment["name"] = yes_no(
        args.name,
        "Can we collect the notebook name?",
        experiment["name"] if args.keep else None
    )
    experiment["code"] = yes_no(
        args.code,
        "Can we collect the notebook code?",
        experiment["code"] if args.keep else None
    )
    experiment["sendServer"] = yes_no(
        args.send,
        "Can we send the collected data to a server on the fly?",
        experiment["sendServer"] if args.keep else None
    )
    experiment["server"] = args.server or (experiment["server"] if args.keep else DEFAULT_EXPERIMENT_SERVER)
    experiment["enabled"] = True 
    save_home_config(data)
    data["header"] = "Configure"
    data["operation"] = "start"
    data["date"] = datetime.now().isoformat()
    log(data, "experiment", data)
    print("Experiment started! Do not forget to use `jupyter lab` or `julynter lab` during the next week")


def end_experiment_cmd(args, rest):
    data = load_home_config()
    data['experiment']['enabled'] = False
    save_home_config(data)
    data['experiment']['enabled'] = True
    data["header"] = "Configure"
    data["operation"] = "stop"
    data["date"] = datetime.now().isoformat()
    log(data, "experiment", data)
    print("Experiment stoped!")

    if not args.prevent_zip:
        zip_experiment_cmd(args, rest)
    

def zip_experiment_cmd(args, rest):
    save_cwd = os.getcwd()
    zip_filename = os.path.abspath(args.file)
    archive_dir = os.path.dirname(zip_filename)
    root_dir = home_config_path()
    os.chdir(root_dir)
    base_dir = os.curdir
    try:
        if archive_dir and not os.path.exists(archive_dir):
            os.makedirs(archive_dir)
        with zipfile.ZipFile(zip_filename, "w",
                             compression=zipfile.ZIP_DEFLATED) as zf:
            path = os.path.normpath(base_dir)
            if path != os.curdir:
                zf.write(path, path)
            for dirpath, dirnames, filenames in os.walk(base_dir):
                for name in sorted(dirnames):
                    path = os.path.normpath(os.path.join(dirpath, name))
                    if not args.ignore_sent or not path.startswith('sent_'):
                        zf.write(path, path)
                for name in filenames:
                    path = os.path.normpath(os.path.join(dirpath, name))
                    if not args.ignore_sent or not path.startswith('sent_'):
                        if os.path.isfile(path):
                            zf.write(path, path)
    finally:
        os.chdir(save_cwd)

    print("Experiment pack {} created!".format(args.file))
    print("Please, send it to https://forms.gle/HmcP47AJoKMmmUms7")


def create_subparsers(subparsers):
    expparser = subparsers.add_parser(
        'experiment', help="Configure Julynter experiment"
    )
    expparser.set_defaults(func=base_experiment_cmd, command=expparser)
    expparser_sub = expparser.add_subparsers()

    expparser_start = expparser_sub.add_parser(
        "start", help="Start Julynter experiment"
    )
    expparser_start.set_defaults(expfunc=start_experiment_cmd)
    expparser_start.add_argument(
        '-k', '--keep', default=None, action="store_true",
        help='Keep old values'
    )
    expparser_start.add_argument(
        '-i', '--id', default=None, nargs='?', const="<ask>", 
        help='Experiment id'
    )
    expparser_start.add_argument(
        '-m', '--linting-messages', type=validate_yes_no,
        nargs='?', default=None, const="<ask>", 
        help='Collect linting messages'
    )
    expparser_start.add_argument(
        '-t', '--linting-types', type=validate_yes_no, nargs='?',
        default=None, const="<ask>",
        help='Collect linting types'
    )
    expparser_start.add_argument(
        '-a', '--activity', type=validate_yes_no, nargs='?', 
        default=None, const="<ask>",
        help='Collect activity'
    )
    expparser_start.add_argument(
        '-e', '--execution', type=validate_yes_no, nargs='?',
        default=None, const="<ask>",
        help='Collect execution'
    )
    expparser_start.add_argument(
        '-n', '--name', type=validate_yes_no, nargs='?',
        default=None, const="<ask>",
        help='Collect notebook name'
    )
    expparser_start.add_argument(
        '-c', '--code', type=validate_yes_no, nargs='?', 
        default=None, const="<ask>", 
        help='Collect notebook code'
    )
    expparser_start.add_argument(
        '-s', '--send', type=validate_yes_no, nargs='?', 
        default=None, const="<ask>",
        help='Send experiment to server'
    )
    expparser_start.add_argument(
        '--server', default=None,
        help='Experiment server'
    )
    
    
    expparser_stop = expparser_sub.add_parser(
        "stop", help="Stop Julynter experiment"
    )
    expparser_stop.set_defaults(expfunc=end_experiment_cmd)
    expparser_stop.add_argument(
        '-z', '--prevent-zip', action="store_true",
        help='Prevent it from generating pack'
    )
    expparser_stop.add_argument(
        '-f', '--file', type=str, default="julynter_experiment.zip",
        help='Output path for experiment pack'
    )
    expparser_stop.add_argument(
        '-s', '--ignore-sent', action="store_true",
        help='Ignore sent files'
    )


    expparser_zip = expparser_sub.add_parser("zip", help="Zip current experiment results")
    expparser_zip.set_defaults(expfunc=zip_experiment_cmd)
    expparser_zip.add_argument(
        '-f', '--file', type=str, default="julynter_experiment.zip",
        help='Output path for experiment pack'
    )
    expparser_zip.add_argument(
        '-s', '--ignore-sent', action="store_true",
        help='Ignore sent files'
    )
