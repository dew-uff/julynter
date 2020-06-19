import json
import os
from pathlib import Path

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


def merge(old, new):
    """ Merge dicts """
    for key, value in new.items():
        if key in old and isinstance(old[key], dict):
            old[key] = merge(old[key], value)
        else:
            old[key] = value
    return old
        

class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post, 
    # patch, put, delete, options) to ensure only authorized user can request the 
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        data = load_config(Path.home() / '.julynter')
        new_data = load_config(Path.cwd() / '.julynter')
        data = merge(data, new_data)
        if "experiment" not in data:
            data["experiment"] = {
                'id': '<unset>',
                'lintingMessage': False,
                'lintingTypes': False,
                'execution': False,
                'code': False,
                'enabled': False
            }
        self.finish(json.dumps(data))


def setup_handlers(web_app):
    host_pattern = ".*$"
    
    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "julynter", "config")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
