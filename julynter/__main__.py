"""Julynter package main"""
import sys

if sys.version_info < (3, 5):
    from .oldcmd import main
else:
    from .cmd import main

main()
