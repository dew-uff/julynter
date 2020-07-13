from pathlib import Path
import json


DEFAULT_EXPERIMENT_SERVER = "https://julynter.npimentel.net"
CONFIG_DIR = '.julynter'


def home_config_path():
    return Path.home() / CONFIG_DIR


def load_home_config():
    data = load_config(home_config_path())
    add_experiment(data)
    return data


def load_project_config(merge_home=True):
    project_config = load_config(Path.cwd() / CONFIG_DIR)
    if merge_home:
        home_config = load_home_config()
        project_config = merge(home_config, project_config)
    return project_config


def save_home_config(data):
    return save_config(home_config_path(), data)


def save_project_config(data):
    return save_config(Path.cwd() / CONFIG_DIR, data)


def load_config(base):
    """ Load julynter config file """
    data = {}
    try:
        if base.is_dir() and (base / 'config.json').is_file():
            with open(str(base / 'config.json'), 'r') as f:
                data = json.load(f)
        elif base.with_suffix('.rc').is_file():
            with open(str(base.with_suffix('.rc')), 'r') as f:
                data = json.load(f)
    except json.JSONDecodeError as e:
        print("Julynter Config ({}) decode error:".format(base), e)
    return data


def save_config(base, data):
    """ Save julynter config file """
    try:
        if base.with_suffix('.rc').is_file():
            with open(str(base.with_suffix('.rc')), 'w') as f:
                json.dump(data, f)
        else:
            base.mkdir(parents=True, exist_ok=True)
            with open(str(base / 'config.json'), 'w') as f:
                json.dump(data, f)

        return True
    except json.JSONDecodeError as e:
        print("Julynter Config ({}) encode error:".format(base), e)
    return False


def add_experiment(data):
    if "experiment" not in data:
        data["experiment"] = {}
    exp = data['experiment']
    exp['id'] = exp.get('id', '<unset>')
    exp['lintingMessage'] = exp.get('lintingMessage', False)
    exp['lintingTypes'] = exp.get('lintingTypes', False)
    exp['activity'] = exp.get('activity', False)
    exp['execution'] = exp.get('execution', False)
    exp['code'] = exp.get('code', False)
    exp['name'] = exp.get('name', False)
    exp['enabled'] = exp.get('enabled', False)
    exp['sendServer'] = exp.get('sendServer', False)
    exp["server"] = exp.get("server", DEFAULT_EXPERIMENT_SERVER)


def merge(old, new):
    """ Merge dicts """
    for key, value in new.items():
        if key in old and isinstance(old[key], dict):
            old[key] = merge(old[key], value)
        else:
            old[key] = value
    return old
        