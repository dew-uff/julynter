# Julynter

![Github Actions Status](https://github.com/dew-uff/julynter/workflows/Build/badge.svg)

Julynter is a linter for Jupyter Notebooks that aims at improving their Quality and Reproducibility based on the following guidelines [1]:

- Use short titles with a restrict  charset (A-Z a-z 0-9 .-) for notebook  files and markdown headings for more detailed ones in the body.
- Pay attention to the bottom of the  notebook. Check whether it can benefit from descriptive markdown cells or can have code cells executed or removed.
- Abstract code into functions, classes, and modules and test them.
- Declare the dependencies in  requirement files and pin the versions of all packages.
- Use a clean environment for testing the dependencies to check if all of them are declared.
- Put imports at the beginning of notebooks.
- Use relative paths for accessing data in the repository.
- Re-run notebooks top to bottom  before committing.


This repository provides an extension for Jupyter Lab compose of two parts:  a Python package named `julynter`
for the server extension and a NPM package named `julynter`
for the frontend extension.



## Team


- João Felipe Pimentel (UFF) (main developer)
- Leonardo Murta (UFF)
- Vanessa Braganholo (UFF)
- Juliana Freire (NYU)


## Publications

- [1] Pimentel, J. F., Murta, L., Braganholo, V., & Freire, J. (2019, May). A large-scale study about quality and reproducibility of jupyter notebooks. In 2019 IEEE/ACM 16th International Conference on Mining Software Repositories (MSR) (pp. 507-517). IEEE.

## Requirements

* JupyterLab >= 2.0

## Install

Note: You will need NodeJS to install the extension.

```bash
pip install julynter
jupyter lab build
```

## Troubleshoot

If you are seeing the frontend extension but it is not working, check
that the server extension is enabled:

```bash
jupyter serverextension list
```

If the server extension is installed and enabled but you are not seeing
the frontend, check the frontend is installed:

```bash
jupyter labextension list
```

If it is installed, try:

```bash
jupyter lab clean
jupyter lab build
```

## Contributing

### Install

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Move to julynter directory

# Install server extension
pip install -e .
# Register server extension
jupyter serverextension enable --py julynter --sys-prefix

# Install dependencies
jlpm
# Build Typescript source
jlpm build
# Link your development version of the extension with JupyterLab
jupyter labextension link .
# Rebuild Typescript source after making changes
jlpm build
# Rebuild JupyterLab after making any changes
jupyter lab build
```

You can watch the source directory and run JupyterLab in watch mode to watch for changes in the extension's source and automatically rebuild the extension and application.

```bash
# Watch the source directory in another terminal tab
jlpm watch
# Run jupyterlab in watch mode in one terminal tab
jupyter lab --watch
```

### Uninstall

```bash
pip uninstall julynter
jupyter labextension uninstall julynter
```

