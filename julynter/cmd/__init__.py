import argparse
import sys

from . import julynterlab
from . import experiment


def main():
    parser = argparse.ArgumentParser(description='Lint Jupyter Notebooks')
    subparsers = parser.add_subparsers()

    julynterlab.create_subparsers(subparsers)
    experiment.create_subparsers(subparsers)
    
    args, rest = parser.parse_known_args()
    if not getattr(args, 'func', None):
        parser.print_help()
    else:
        args.func(args, rest)
