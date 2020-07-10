import json
import os
from threading import Lock
from datetime import date
from pathlib import Path
from pprint import pprint

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from .config import load_config, save_config, add_experiment, merge
from .config import home_config_path, load_home_config, load_project_config
from .config import save_home_config, save_project_config
import tornado


LOG_LOCK = Lock()


def log(data, folder="errors"):
    today = date.today()
    path = home_config_path() / folder / "{}{}".format(today.year, today.month)
    path.mkdir(parents=True, exist_ok=True)
    with LOG_LOCK:
        with open(str(path / "{}.log".format(today.day)), 'a') as f:
            f.write('\n')
            json.dump(data, f)


class ProjectConfig(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps(load_project_config()))

    @tornado.web.authenticated
    def post(self):
        config = load_project_config(merge_home=False)
        input_data = self.get_json_body()
        if save_project_config(merge(config, input_data)):
            self.finish(json.dumps({'result': 'ok'}))


class UserConfig(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps(load_home_config()))
    
    @tornado.web.authenticated
    def post(self):
        config = load_home_config()
        input_data = self.get_json_body()
        if save_home_config(merge(config, input_data)):
            self.finish(json.dumps({'result': 'ok'}))


class ExperimentData(APIHandler):
    
    @tornado.web.authenticated
    def post(self):
        config = load_project_config()
        
        input_data = self.get_json_body()
        if config['experiment']['enabled']:
            input_data["experiment_id"] = config["experiment"]["id"]
            log(input_data, 'experiment')


class ErrorData(APIHandler):
    
    @tornado.web.authenticated
    def post(self):
        input_data = self.get_json_body()
        log(input_data)


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
