import json
import os
from pathlib import Path
from pprint import pprint

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
import tornado

def load_config(base):
    """ Load julynter config file """
    data = {}
    try:
        if base.is_dir() and (base / 'config.json').is_file():
            with open(str(base / 'config.json'), 'r') as f:
                data = json.load(f)
        elif base.is_file():
            with open(str(base), 'r') as f:
                data = json.load(f)
    except json.JSONDecodeError as e:
        print("Julynter Config ({}) decode error:".format(base), e)
    return data


def save_config(base, data):
    """ Save julynter config file """
    try:
        if base.is_file():
            with open(str(base), 'w') as f:
                json.dump(data, f)
        else:
            base.mkdir(parents=True, exist_ok=True)
            with open(str(base / 'config.json'), 'w') as f:
                json.dump(data, f)

        return True
    except json.JSONEncodeError as e:
        print("Julynter Config ({}) encode error:".format(base), e)
    return False

def merge(old, new):
    """ Merge dicts """
    for key, value in new.items():
        if key in old and isinstance(old[key], dict):
            old[key] = merge(old[key], value)
        else:
            old[key] = value
    return old
        

def add_experiment(data):
    if "experiment" not in data:
        data["experiment"] = {
            'id': '<unset>',
            'lintingMessage': False,
            'lintingTypes': False,
            'execution': False,
            'code': False,
            'enabled': False
        }

class ProjectConfig(APIHandler):
    @tornado.web.authenticated
    def get(self):
        data = load_config(Path.home() / '.julynter')
        new_data = load_config(Path.cwd() / '.julynter')
        data = merge(data, new_data)
        add_experiment(data)
        self.finish(json.dumps(data))

    @tornado.web.authenticated
    def post(self):
        data = load_config(Path.cwd() / '.julynter')
        input_data = self.get_json_body()
        data = merge(data, input_data)
        if save_config(Path.cwd() / '.julynter', data):
            self.finish(json.dumps({'result': 'ok'}))

class UserConfig(APIHandler):
    @tornado.web.authenticated
    def get(self):
        data = load_config(Path.home() / '.julynter')
        add_experiment(data)
        self.finish(json.dumps(data))
    
    @tornado.web.authenticated
    def post(self):
        data = load_config(Path.home() / '.julynter')
        input_data = self.get_json_body()
        data = merge(data, input_data)
        if save_config(Path.home() / '.julynter', data):
            self.finish(json.dumps({'result': 'ok'}))


class ExperimentData(APIHandler):
    
    @tornado.web.authenticated
    def post(self):
        config = load_config(Path.home() / '.julynter')
        new_config = load_config(Path.cwd() / '.julynter')
        config = merge(config, new_config)
        add_experiment(config)
        
        input_data = self.get_json_body()
        pprint(input_data)

class ErrorData(APIHandler):
    
    @tornado.web.authenticated
    def post(self):
        input_data = self.get_json_body()
        pprint(input_data)
        # ToDo: save input_data

def setup_handlers(web_app):
    host_pattern = ".*$"
    
    base_url = web_app.settings["base_url"]
    handlers = [
        (url_path_join(base_url, "julynter", "config"), ProjectConfig),
        (url_path_join(base_url, "julynter", "userconfig"), UserConfig),
        (url_path_join(base_url, "julynter", "experiment"), ExperimentData),
        (url_path_join(base_url, "julynter", "error"), ErrorData),
    ]
    web_app.add_handlers(host_pattern, handlers)
