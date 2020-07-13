import json
import requests
import queue

from datetime import date
from threading import Lock

from .config import home_config_path, load_project_config

from requests_futures.sessions import FuturesSession

LOG_LOCK = Lock()


def create_hook(data, folder, config):
    def log_hook(response, *args, **kwargs):
        newfolder = folder
        try:
            if response.status_code == 200:
                result = response.json()
                if result.get('ok', False):
                    newfolder = "sent_" + folder
                    if "id" in result:
                        data["mid"] = result["id"]
        except Exception as e:
            print("Failed to send to server", e)
        save_log(data, newfolder, config)
    return log_hook


def log(data, folder="errors", config=None):
    config = config or load_project_config()
    if config["experiment"]["enabled"] and config["experiment"]["sendServer"]:
        try:
            session = FuturesSession()
            future = session.post(config["experiment"]["server"], json={
                'mtype': folder,
                'mtext': data,
                "mexperiment_id": config["experiment"]["id"],
            }, hooks={
                'response': create_hook(data, folder, config),
            })
        except Exception as e:
            print("Failed to send to server", e)
    else:
        save_log(data, folder, config)


def save_log(data, folder, config):
    today = date.today()
    path = home_config_path() / folder / "{}{}".format(today.year, today.month)
    path.mkdir(parents=True, exist_ok=True)
    with LOG_LOCK:
        try:
            with open(str(path / "{}.log".format(today.day)), 'a') as f:
                f.write('\n')
                json.dump(data, f)
        except json.JSONDecodeError as e:
            print("Failed to save", data, e)

