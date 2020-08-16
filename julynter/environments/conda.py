"""Conda environment definition"""
import shutil

from pathlib import Path
from subprocess import CompletedProcess, CalledProcessError
from .base import Environment
from .process import async_run


class CondaEnvironment(Environment):
    """Conda environment"""

    def __init__(
            self, operation="--clone base", conda_path="~/anaconda3/",
            envname="julynterwork", remove=True, create=True, **kwargs
    ):
        # pylint: disable=too-many-arguments
        super().__init__(remove=remove, create=create, **kwargs)
        self.operation = operation
        self.anaconda_path = Path(conda_path).expanduser()
        self.envname = envname

    def args(self, cmd):
        cmd_str = [
            ". {}/etc/profile.d/conda.sh".format(self.anaconda_path),
            "conda activate {}".format(self.envname)
        ]
        cmd_str.append(
            cmd
        )

        return [
            "/bin/bash", "-c",
            " && ".join(cmd_str)
        ]

    def _remove_args(self):
        cmd_str = [
            ". {}/etc/profile.d/conda.sh ".format(self.anaconda_path),
            "conda env remove --name {} -y".format(self.envname)
        ]
        return [
            "/bin/bash", "-c",
            " && ".join(cmd_str)
        ]

    def _create_args(self):
        cmd_str = [
            ". {}/etc/profile.d/conda.sh ".format(self.anaconda_path),
            "conda create -y --name {} {}".format(self.envname, self.operation)
        ]
        return [
            "/bin/bash", "-c",
            " && ".join(cmd_str)
        ]

    async def __aenter__(self):
        if self.create:
            await async_run(self._remove_args())
            shutil.rmtree(str(self.anaconda_path / "envs" / self.envname), ignore_errors=True)
            result = await async_run(self._create_args())
            if result.returncode != 0:
                return (None, result)
            return (self, result)
        return (self, CompletedProcess([], 0, b'', b''))

    async def __aexit__(self, typ, value, traceback):
        if self.remove:
            try:
                result = await async_run(self._remove_args())
                if result.returncode != 0:
                    print("WARNING: failed to remove environment {}".format(self.envname))
                    result.check_returncode()
            except CalledProcessError:
                shutil.rmtree(str(self.anaconda_path / "envs" / self.envname), ignore_errors=True)

    def report(self):
        print("Conda env: {}".format(self.envname))
