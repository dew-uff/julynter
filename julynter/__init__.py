"""Julynter module"""
import json
import sys
from pathlib import Path

from ._version import __version__

if sys.version_info < (3, 5):
    from .oldcmd import main
else:
    from .handlers import setup_handlers
    from .cmd import main

    HERE = Path(__file__).parent.resolve()

    with (HERE / "labextension" / "package.json").open() as fid:
        data = json.load(fid)


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": data["name"]
    }]

def _jupyter_server_extension_paths():
    """Register julynter server extension"""
    return [{
        "module": "julynter"
    }]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    setup_handlers(server_app.web_app)
    server_app.log.info("Registered HelloWorld extension at URL path /jftemp")

# For backward compatibility with notebook server - useful for Binder/JupyterHub
load_jupyter_server_extension = _load_jupyter_server_extension

if __name__ == "__main__":
    main()
