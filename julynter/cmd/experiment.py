import zipfile
import os
from ..config import load_home_config, save_home_config, home_config_path
import shutil
from pathlib import Path



def base_experiment_cmd(args, rest):
    if not getattr(args, 'expfunc', None):
        args.command.print_help()
    else:
        args.expfunc(args, rest)


def non_empty(value, question):
    if value:
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
    if value is None:
        return value
    check_value = value.strip().lower()
    if check_value in ("", "y", "yes", "t", "true", "1"):
        return True
    elif check_value in ("n", "no", "f", "false", "0"):
        return False


def yes_no(value, question):
    if value is not None:
        return value

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
    eid = non_empty(args.id, "What is your participant ID?")
    linting_messages = yes_no(
        args.linting_messages,
        "Can we collect linting messages that appear for you?"
    )
    if linting_messages:
        linting_types = True
    else:
        linting_types = yes_no(
            args.linting_types,
            "Can we collect the types of linting messages?"
        )
    activity = yes_no(
        args.activity,
        "Can we collect activity information (i.e., Julynter filters, notebook opening and closing)?"
    )
    execution = yes_no(
        args.execution,
        "Can we collect execution information (i.e., size of executed cells, type of execution output)?"
    )
    name = yes_no(
        args.name,
        "Can we collect the notebook name?"
    )
    code = yes_no(
        args.code,
        "Can we collect the notebook code?"
    )
    experiment = {
        'id': eid,
        'lintingMessage': linting_messages,
        'lintingTypes': linting_types,
        'activity': activity,
        'execution': execution,
        'code': code,
        'name': name,
        'enabled': True,
    }
    data = load_home_config()
    data['experiment'] = experiment
    save_home_config(data)

    print("Experiment started! Do not forget to use `jupyter lab` or `julynter lab` during the next week")


def end_experiment_cmd(args, rest):
    data = load_home_config()
    data['experiment']['id'] = '<unset>'
    data['experiment']['enabled'] = False    
    save_home_config(data)
    print("Experiment stoped!")

    if not args.prevent_zip:
        zip_experiment_cmd(args, rest)
    

def zip_experiment_cmd(args, rest):
    shutil.make_archive(args.dir, 'zip', home_config_path())
    print("Experiment pack {}.zip created!".format(args.dir))
    print("Please, send it to jpimentel@ic.uff.br")


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
        '-i', '--id', default=None,
        help='Experiment id'
    )
    expparser_start.add_argument(
        '-m', '--linting-messages', type=validate_yes_no,
        nargs='?', default=None, const=True, 
        help='Collect linting messages'
    )
    expparser_start.add_argument(
        '-t', '--linting-types', type=validate_yes_no, nargs='?',
        default=None, const=True,
        help='Collect linting types'
    )
    expparser_start.add_argument(
        '-a', '--activity', type=validate_yes_no, nargs='?', 
        default=None, const=True,
        help='Collect activity'
    )
    expparser_start.add_argument(
        '-e', '--execution', type=validate_yes_no, nargs='?',
        default=None, const=True,
        help='Collect execution'
    )
    expparser_start.add_argument(
        '-n', '--name', type=validate_yes_no, nargs='?',
        default=None, const=True,
        help='Collect notebook name'
    )
    expparser_start.add_argument(
        '-c', '--code', type=validate_yes_no, nargs='?', 
        default=None, const=True, 
        help='Collect notebook code'
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
        '-d', '--dir', type=str, default="julynter_experiment",
        help='Output path for experiment pack'
    )


    expparser_zip = expparser_sub.add_parser("zip", help="Zip current experiment results")
    expparser_zip.set_defaults(expfunc=zip_experiment_cmd)
    expparser_zip.add_argument(
        '-d', '--dir', type=str, default="julynter_experiment",
        help='Output path for experiment pack'
    )
