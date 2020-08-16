"""Handle Server extension requests"""
import json

import tornado
from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from .config import merge
from .config import load_home_config, load_project_config
from .config import save_home_config, save_project_config
from .util import log


class ProjectConfig(APIHandler):
    """Get and set project config"""
    # pylint: disable=abstract-method
    @tornado.web.authenticated
    def get(self):
        """Get project config"""
        self.finish(json.dumps(load_project_config()))

    @tornado.web.authenticated
    def post(self):
        """Set project config"""
        config = load_project_config(merge_home=False)
        input_data = self.get_json_body()
        if save_project_config(merge(config, input_data)):
            self.finish(json.dumps({'result': 'ok'}))


class UserConfig(APIHandler):
    """Get and set user config"""
    # pylint: disable=abstract-method
    @tornado.web.authenticated
    def get(self):
        """Get user config"""
        self.finish(json.dumps(load_home_config()))

    @tornado.web.authenticated
    def post(self):
        """Set user config"""
        config = load_home_config()
        input_data = self.get_json_body()
        if save_home_config(merge(config, input_data)):
            self.finish(json.dumps({'result': 'ok'}))


class ExperimentData(APIHandler):
    """Send experiment data"""
    # pylint: disable=abstract-method

    @tornado.web.authenticated
    def post(self):
        """Send experiment data"""
        config = load_project_config()

        input_data = self.get_json_body()
        if config['experiment']['enabled']:
            log(input_data, 'experiment', config)


class ErrorData(APIHandler):
    """Send error data"""
    # pylint: disable=abstract-method

    @tornado.web.authenticated
    def post(self):
        """Send error data"""
        input_data = self.get_json_body()
        log(input_data)


def setup_handlers(web_app):
    """Setup notebook handlers"""
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    handlers = [
        (url_path_join(base_url, "julynter", "config"), ProjectConfig),
        (url_path_join(base_url, "julynter", "userconfig"), UserConfig),
        (url_path_join(base_url, "julynter", "experiment"), ExperimentData),
        (url_path_join(base_url, "julynter", "error"), ErrorData),
    ]
    web_app.add_handlers(host_pattern, handlers)
