"""Venv environment definition"""
import shutil

from subprocess import CompletedProcess
from .base import Environment
from .process import async_run


class VenvEnvironment(Environment):
    """Venv environment"""

    def __init__(
            self, command="python -m venv",
            envname=".julynterwork", remove=True, create=True, **kwargs
    ):
        # pylint: disable=too-many-arguments
        super().__init__(create=create, remove=remove, **kwargs)
        self.command = command
        self.envname = envname

    def args(self, cmd):
        cmd_str = [
            "source {}/bin/activate".format(self.envname),
        ]
        cmd_str.append(
            cmd
        )

        return [
            "/bin/bash", "-c",
            " && ".join(cmd_str)
        ]

    def _create_args(self):
        cmd_str = [
            "{} {}".format(self.command, self.envname)
        ]
        return [
            "/bin/bash", "-c",
            " && ".join(cmd_str)
        ]

    async def __aenter__(self):
        if self.create:
            shutil.rmtree(self.envname, ignore_errors=True)
            result = await async_run(self._create_args())
            if result.returncode != 0:
                return (None, result)
            return (self, result)
        return (self, CompletedProcess([], 0, b'', b''))

    async def __aexit__(self, typ, value, traceback):
        if self.remove:
            shutil.rmtree(self.envname, ignore_errors=True)

    def report(self):
        print("VEnvironment: {}".format(self.envname))
