import json
import requests

from datetime import date
from threading import Lock

from .config import home_config_path, load_project_config

LOG_LOCK = Lock()


def log(data, folder="errors", config=None):
    config = config or load_project_config()

    if config["experiment"]["enabled"] and config["experiment"]["sendServer"]:
        try:
            response = requests.post(config["experiment"]["server"], json={
                'mtype': folder,
                'mtext': data,
                "mexperiment_id": config["experiment"]["id"],
            })
            if response.status_code == 200:
                result = response.json()
                if result.get('ok', False):
                    folder = "sent_" + folder
                    if "id" in result:
                        data["mid"] = result["id"]
        except Exception as e:
            print("Failed to send to server", e)

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

