"""Utility module"""
# pylint: disable=unused-import
from __future__ import print_function
import json
import sys

from datetime import date
from threading import Lock

from requests_futures.sessions import FuturesSession
from timeout_decorator import timeout, timeout_decorator
from timeout_decorator import TimeoutError as TimeDecoratorError

from .config import home_config_path, load_project_config
from ._version import __version__


VERBOSE = -1
LOG_LOCK = Lock()
EXITED = False

if sys.version_info < (3, 0):
    TimeoutException = RuntimeError
    String = unicode  # pylint: disable=undefined-variable
    Bytes = str
    encode_r = lambda x: x.decode('utf-8')
else:
    TimeoutException = TimeoutError
    String = str
    Bytes = bytes
    encode_r = lambda x: x


if sys.version_info <= (3, 4):
    from pathlib2 import Path  # pylint: disable=import-error
else:
    from pathlib import Path


def _target(queue, function, *args, **kwargs):
    """Run a function with arguments and return output via a queue.
    This is a helper function for the Process created in _Timeout. It runs
    the function with positional arguments and keyword arguments and then
    returns the function's output by way of a queue. If an exception gets
    raised, it is returned to _Timeout to be raised by the value property.
    """
    try:
        queue.put((True, function(*args, **kwargs)))
    except:  # pylint: disable=bare-except
        #traceback.print_exc()
        queue.put((False, sys.exc_info()[1]))


timeout_decorator._target = _target  # pylint: disable=protected-access



def to_unicode(text):
    """Convert to unicode"""
    if sys.version_info < (3, 0):
        if isinstance(text, unicode):  # pylint: disable=undefined-variable
            return text
        return str(text).decode("utf-8")
    if isinstance(text, str):
        return text
    return bytes(text).decode("utf-8")


def vprint(level, *args):
    """Print according to verbose level"""
    if VERBOSE > level:
        if level > 0:
            print(">" * level, *args)
        else:
            print(*args)


def create_hook(data, folder):
    """Create hook to send experiment data to server"""
    def log_hook(response, *_args, **_kwargs):
        """Hook that sends experiment data to server"""
        newfolder = folder
        try:
            if response.status_code == 200:
                result = response.json()
                if result.get('ok', False):
                    newfolder = "sent_" + folder
                    if "id" in result:
                        data["mid"] = result["id"]
        except Exception as exc:  # pylint: disable=broad-except
            print("Failed to send to server", exc)
        save_log(data, newfolder)
    return log_hook


def log(data, folder="errors", config=None):
    """Log commands to server"""
    config = config or load_project_config()
    if config["experiment"]["enabled"] and config["experiment"]["sendServer"]:
        try:
            session = FuturesSession()
            session.post(config["experiment"]["server"], json={
                'mtype': folder,
                'mtext': data,
                "mexperiment_id": config["experiment"]["id"],
                'version': __version__
            }, hooks={
                'response': create_hook(data, folder),
            })
        except Exception as exc:  # pylint: disable=broad-except
            print("Failed to send to server", exc)
    else:
        save_log(data, folder)


def save_log(data, folder):
    """Save log to folder"""
    today = date.today()
    path = home_config_path() / folder / "{}{}".format(today.year, today.month)
    path.mkdir(parents=True, exist_ok=True)
    with LOG_LOCK:
        try:
            with open(str(path / "{}.log".format(today.day)), 'a') as fil:
                fil.write('\n')
                json.dump(data, fil)
        except json.JSONDecodeError as exc:
            print("Failed to save", data, exc)


def do_exit(exitcode, command=None):
    """Exit program"""
    # pylint: disable=global-statement
    global EXITED
    EXITED = True
    data = {
        "header": "CLI",
        "operation": command or " ".join(sys.argv[1:2]),
        "param": " ".join(sys.argv[1:]),
        "info": str(exitcode),
    }
    log(data, "experiment")
    sys.exit(exitcode)
