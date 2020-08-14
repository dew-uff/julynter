"""Environment orchestrator"""
import json
from .. import util
from ..util import vprint
from ..runner.runner import clean_diff_result, clean_result, clean_fail
from .process import printout, printerr
from .base import Environment

class EnvironmentOrchestrator:
    """Prepare and run notebook in environment"""

    def __init__(
            self, environment: Environment,
            dryrun_install=False, dryrun_execute=False,
            install_julynter=True, show_output=False,
            initial_verbose=0,
        ):
        # pylint: disable=too-many-arguments
        self.environment: Environment = environment
        self.dryrun_install = dryrun_install
        self.dryrun_execute = dryrun_execute
        self.should_install_julynter = install_julynter
        self.iverbose = initial_verbose
        self.show_output = show_output

        self.install_map = {
            "setup.py": self.install_setups,
            "requirements.txt": self.install_requirements,
            "Pipfile": self.install_pipfiles,
            "Pipfile.lock": self.install_pipfiles
        }

    def rprint(self, num, text):
        """Print in hierarchy"""
        # pylint: disable=no-self-use
        vprint(num, text)

    async def execute_environment(self, cwd, install, notebooks, args):
        """Execute notebookes in environment"""
        async with self.environment as (environment, result):
            if not environment:
                msg = result.stderr.decode('utf-8')
                self.rprint(self.iverbose, "Failed to prepare environment due '{}'".format(msg))
                return {
                    'fail': 'prepare-env',
                    'reason': '<Failed to prepare environment>',
                    'msg': msg
                }

            install_fail = await self.install(cwd, install)
            if install_fail:
                return install_fail
            if notebooks:
                return await self.execute_notebooks(cwd, notebooks, args)
            return {
                'fail': 'no-notebooks',
                'reason': '<no notebooks were specified>',
                'msg': 'prepared environment'
            }

    def _output_data(self, result):
        """Get stdout and stderr from arun"""
        # pylint: disable=no-self-use
        return (
            b"##<>##\nOutput:\n"
            + result.stdout.strip()
            + b"\n##<>##Error:\n"
            + result.stderr.strip()
        )

    def run(self, param, **kwargs):
        """Run param and show results"""
        args = [param]
        if self.show_output:
            args.append(printout)
            args.append(printerr)
        return self.environment.arun(*args, **kwargs)


    async def install_setups(self, cwd, names):
        """Install setup.py files"""
        for name in names:
            if not name:
                continue
            path = (cwd / name).parents[0]
            self.rprint(self.iverbose + 1, "Installing setup {}".format(path))
            result = await self.run(
                "GIT_TERMINAL_PROMPT=0 pip install  --progress-bar off -e '{}'".format(
                    str(path).replace("'", "'\\''")
                ),
            )
            data = self._output_data(result)
            if result.returncode != 0:
                return (False, data)
        return (True, b"")

    async def install_requirements(self, cwd, names):
        """Install requirements.txt files"""
        for name in names:
            if not name:
                continue
            path = (cwd / name)
            self.rprint(self.iverbose + 1, "Installing requirements {}".format(path))
            result = await self.run(
                "GIT_TERMINAL_PROMPT=0 pip install --progress-bar off -r '{}'".format(
                    str(path).replace("'", "'\\''"),
                ),
            )
            data = self._output_data(result)
            if result.returncode != 0:
                return (False, data)
        return (True, b"")

    async def install_pipfiles(self, cwd, names):
        """Install Pipfile files"""
        for name in names:
            if not name:
                continue
            path = (cwd / name)
            self.rprint(self.iverbose + 1, "Converting to requirements.txt: {}".format(path))
            result = await self.run(
                "julynter extractpipenv -p '{}' -o '_julynter_requirements.txt'".format(
                    str(cwd / name)
                ),
            )
            data = self._output_data(result)
            if result.returncode != 0:
                return (False, data)
            result, data = await self.install_requirements(
                path.parents[0], ["_julynter_requirements.txt"],
            )
            if not result:
                return (False, data)
        return (True, b"")

    async def install_julynter(self, cwd, _):
        """Install julynter for running notebook"""
        self.rprint(self.iverbose + 1, "Installing julynter")
        # ToDo: replace by julnyter pinned version
        result = await self.run(
            "pip install {}/julynter/dist/julynter-0.4.0a0-py3-none-any.whl".format((cwd / "..").resolve()),
        )
        data = self._output_data(result)
        if result.returncode != 0:
            return (False, data)
        return (True, b"")

    async def install(self, ocwd, files):
        """Install dependencies"""
        # pylint: disable=too-many-locals
        self.rprint(self.iverbose, "{}Installing repository dependencies".format(
            "[DRY RUN] " if self.dryrun_install else ""
        ))
        if self.dryrun_install:
            return None
        install_options = []

        if self.should_install_julynter:
            install_options.append(('julynter', self.install_julynter, []))
        for key, names in files.items():
            if key in self.install_map:
                install_options.append((key, self.install_map[key], names))

        self.extra_install_options(install_options)

        cwd = self.environment.project_wd(ocwd)

        installed = True
        data_ok_list = []
        data_failed_list = []
        data_failed = b""
        for spec, func, names in install_options:
            if self.should_exit():
                return
            success, data = await func(cwd, names)
            installed = installed and success
            spec_bytes = spec.encode("utf-8")
            if success:
                data_ok_list.append(spec_bytes)
            else:
                data_failed += b"\n##<<>>##" + spec_bytes + b":\n" + data
                data_failed_list.append(spec_bytes)

        if not installed:
            cause = b"Ok: " + b", ".join(data_ok_list)
            cause += b"\n##<<>>##Failed: " + b", ".join(data_failed_list)
            cause += data_failed
            return {
                'fail': 'install',
                'reason': "<Install Dependency Error>",
                'msg': cause,
            }
        return None

    def extra_install_options(self, install_options):
        """Specify extra dependencies to install"""

    def should_exit(self):
        """Check if it should exit in the middle"""
        # pylint: disable=no-self-use
        return False

    async def execute_notebooks(self, ocwd, notebooks, args):
        """Execute notebooks"""
        self.rprint(self.iverbose, "{}Running {} notebooks".format(
            "[DRY RUN] " if self.dryrun_execute else "",
            len(notebooks)
        ))
        result = {}
        if self.dryrun_execute:
            for notebook in notebooks:
                vprint(
                    2,
                    "[DRY RUN] Would run notebook {} {}"
                    .format(notebook, args)
                )
            result["fail"] = "dryrun"
            return result

        result["notebooks"] = {}
        cwd = self.environment.project_wd(ocwd)
        if "-v" not in args and util.VERBOSE != -1:
            args += " -v {}".format(util.VERBOSE)
        if "-i" not in args:
            args += " -i {}".format(self.iverbose + 1)
        for notebook in notebooks:
            if self.should_exit():
                return result
            self.rprint(self.iverbose, "Running notebook {}".format(notebook))
            presult = await self.run(
                "julynter run '{}' -w ejson {}".format(
                    str(cwd / notebook).replace("'", "'\\''"),
                    args
                ),
            )
            sep = b"<<<<---julyntersep--->>>>"
            if sep in presult.stdout:
                result["notebooks"][notebook] = json.loads(presult.stdout.split(sep)[-1])
            else:
                nresult = {
                    "execution": clean_result(),
                    "fail": clean_fail(),
                    "diff": clean_diff_result(),
                }
                nresult["execution"]["status"] = "error"
                if presult.returncode != 0:
                    nresult["fail"]["reason"] = "<Failed to run notebook>"
                else:
                    nresult["fail"]["reason"] = "<Failed to parse results>"
                nresult["fail"]["msg"] = self._output_data(presult)
                result["notebooks"][notebook] = nresult
        return result
