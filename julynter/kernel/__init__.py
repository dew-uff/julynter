"""Julynter Kernel analysis"""
from .linter import JulynterKernel

COMM = None

def init():
    """Init julynter"""
    # pylint: disable=undefined-variable, global-statement
    global COMM
    COMM = JulynterKernel(get_ipython())
    COMM.register()
    