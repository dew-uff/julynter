
export JUPYTERLAB_DIR=julynter/julynterlab
# Extensions to install
export NODE_OPTIONS=--max-old-space-size=16000
# Add below the extensions you want to package
jupyter labextension install @julynter/labextension --no-build
jupyter labextension disable @jupyterlab/extensionmanager-extension --no-build
jupyter lab build
jupyter lab clean