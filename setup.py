"""
Setup Module to setup Python Handlers for the jvlinter extension.
"""
import os
import sys

import setuptools

HERE = os.path.abspath(os.path.dirname(__file__))

# The name of the project
name = "julynter"

# Get our version
version_path = os.path.realpath(os.path.join(name, "_version.py"))
version_ns = {}
with open(version_path) as f:
    exec(f.read(), {}, version_ns)
version = version_ns['__version__']

with open("README.md", "r") as fh:
    long_description = fh.read()


if sys.version_info >= (3, 5):
    from jupyter_packaging import (
        create_cmdclass, install_npm, ensure_targets,
        combine_commands, ensure_python, get_version,
        BaseCommand
    )
    # Ensure a valid python version
    ensure_python(">=3.5")
    
    lab_path = os.path.join(HERE, name, "labextension")

    # Representative files that should exist after a successful build
    jstargets = [
        os.path.join(HERE, "lib", "linterlab", "julynter.js"),
    ]

    package_data_spec = {
        name: [
            "*"
        ]
    }

    data_files_spec = [
        ("share/jupyter/lab/extensions", lab_path, "*.tgz"),
        ("etc/jupyter/jupyter_notebook_config.d",
        "jupyter-config", "julynter.json"),
    ]

    cmdclass = create_cmdclass("jsdeps", 
        package_data_spec=package_data_spec,
        data_files_spec=data_files_spec
    )

    cmdclass["jsdeps"] = combine_commands(
        install_npm(HERE, build_cmd="build:all", npm=["jlpm"]),
        ensure_targets(jstargets),
    )
else:
    cmdclass = {}


setup_args = dict(
    name=name,
    version=version,
    url="https://github.com/dew-uff/julynter",
    author="Joao Felipe Pimentel",
    description="A quality checker for Jupyter.",
    long_description=long_description,
    long_description_content_type="text/markdown",
    cmdclass=cmdclass,
    packages=setuptools.find_packages(),
    install_requires=[
        'jupyterlab~=2.0;python_version>="3.5"',
        "requests",
        "requests_futures",
        'timeout-decorator',
        'jupyter',
        'nbformat',
        'pathlib2;python_version<="3.4"',
        'pathlib2;python_version=="2.7"',
    ],
    entry_points={
        "console_scripts": [
            "julynter = julynter:main"
        ]
    },
    zip_safe=False,
    include_package_data=True,
    license="BSD-3-Clause",
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "JupyterLab"],
    classifiers=[
        "License :: OSI Approved :: BSD License",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.5",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Framework :: Jupyter",
    ],
)


if __name__ == "__main__":
    setuptools.setup(**setup_args)
