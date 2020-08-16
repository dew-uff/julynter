"""Docker environment definition"""
from copy import copy

from subprocess import CalledProcessError
from pathlib import Path
from .base import Environment
from .process import async_run


class DockerEnvironment(Environment):
    """Docker environment"""

    def __init__(
            self, name, volumes=None, docker_cmd=None,
            cwd=None, wd="/home/jul/execution",
            create=True, remove=True, **kwargs
    ):
        # pylint: disable=too-many-arguments
        super().__init__(create=create, remove=remove, **kwargs)
        self.name = name
        self.wdir = str(wd)
        cwd = cwd or Path.cwd()
        self.volumes = volumes or {str(cwd.expanduser().resolve()): str(wd)}
        self._container_id = None if create else name
        self.docker_cmd = docker_cmd or []

    def _start_container_cmd(self):
        args = ["docker", "run", "-it", "-d"]
        for source, target in self.volumes.items():
            args.append("-v")
            args.append("{}:{}".format(source, target))
        args.append(self.name)
        args.append("/bin/bash")
        return args

    def _kill_container_cmd(self):
        return ["docker", "container", "kill", self._container_id]

    def _rm_container_cmd(self):
        return ["docker", "container", "rm", "-f", self._container_id]

    def _prune_containers_cmd(self):
        # pylint: disable=no-self-use
        return ["docker", "container", "prune", "-f"]

    def args(self, cmd):
        docker_str = copy(self.docker_cmd)
        docker_str.append(
            cmd
        )

        return [
            "docker", "exec", "-t", self._container_id,
            "/bin/bash", "-c",
            " && ".join(docker_str)
        ]

    def use_existing(self, container_id):
        """Use existing container id"""
        self._container_id = container_id
        return self

    async def __aenter__(self):
        if self.create:
            result = await async_run(self._start_container_cmd())
            if result.returncode != 0:
                return (None, result)
            self._container_id = result.stdout.decode('utf-8').strip()
        return (self, result)

    async def __aexit__(self, typ, value, traceback):
        if not self._container_id:
            return
        if self.remove:
            try:
                result = await async_run(self._kill_container_cmd())
                if result.returncode != 0:
                    print("WARNING: failed to kill container {}".format(self._container_id))
                    result.check_returncode()

                result = await async_run(self._rm_container_cmd())
                if result.returncode != 0:
                    print("WARNING: failed to remove container {}. Trying to prune it"
                          .format(self._container_id))
                    result.check_returncode()

            except CalledProcessError:
                result = await async_run(self._prune_containers_cmd())
                if result.returncode != 0:
                    print("WARNING: failed to remove container {}. Trying to prune it"
                          .format(self._container_id))

    def project_wd(self, cwd):
        """Get project directory in environment"""
        return Path(self.wdir)

    def report(self):
        print("Docker container: {}".format(self._container_id))
