"""Julynter Main CLI"""

import argparse
import sys

from . import julynterlab
from . import experiment
from . import run
from . import env
from . import extractpipenv


def main():
    """Julynter Main CLI"""
    parser = argparse.ArgumentParser(description='Lint Jupyter Notebooks')
    subparsers = parser.add_subparsers()

    julynterlab.create_subparsers(subparsers)
    experiment.create_subparsers(subparsers)
    run.create_subparsers(subparsers)
    env.create_subparsers(subparsers)
    extractpipenv.create_subparsers(subparsers)
    
    args, rest = parser.parse_known_args()
    if not getattr(args, 'func', None):
        parser.print_help()
    else:
        args.func(args, rest)
