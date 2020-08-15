"""Base environment module"""
import asyncio
import os
from subprocess import CompletedProcess
from .process import async_run

class Environment:
    """Base environment class"""

    def __init__(self, *args, remove=True, create=True, **kwargs):
        super().__init__(*args, **kwargs)
        self.default_outdisplay = lambda x: None
        self.default_errdisplay = lambda x: None
        self.remove = remove
        self.create = create

    def args(self, cmd):
        """Return environment args"""
        # pylint: disable=no-self-use
        return [cmd]

    def arun(self, cmd, out_display=None, err_display=None, **kwargs):
        """Run command in environment asynchronously"""
        out_display = out_display or self.default_outdisplay
        err_display = err_display or self.default_errdisplay
        return async_run(self.args(cmd), out_display, err_display, check=False, **kwargs)

    def run(self, cmd, out_display=None, err_display=None, **kwargs):
        """Run command in environment asynchronously"""
        if os.name == 'nt':
            loop = asyncio.ProactorEventLoop() # for subprocess' pipes on Windows
            asyncio.set_event_loop(loop)
        else:
            loop = asyncio.get_event_loop()
        result = loop.run_until_complete(self.arun(cmd, out_display, err_display, **kwargs))
        return result

    async def __aenter__(self):
        return (self, CompletedProcess([], 0, b'', b''))

    async def __aexit__(self, typ, value, traceback):
        return

    def project_wd(self, cwd):
        """Get project directory in environment"""
        # pylint: disable=no-self-use
        return cwd

    def report(self):
        """Report environment name"""
        print("Environment created")


class DryRunEnvironment(Environment):
    """Dry run command"""

    def arun(self, cmd, out_display=None, err_display=None, **kwargs):
        async def dryrun():
            return CompletedProcess([cmd], 0, b'', b'')
        return dryrun()
