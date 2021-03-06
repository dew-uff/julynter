"""Julynter module"""
import sys

from ._version import __version__

if sys.version_info < (3, 5):
    from .oldcmd import main
else:
    from .handlers import setup_handlers
    from .cmd import main


def _jupyter_server_extension_paths():
    """Register julynter server extension"""
    return [{
        "module": "julynter"
    }]


def load_jupyter_server_extension(lab_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    lab_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    setup_handlers(lab_app.web_app)
    lab_app.log.info("Registered Julynter extension at URL path /julynter")


if __name__ == "__main__":
    main()
