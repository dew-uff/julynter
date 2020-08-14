"""Define commands for Python 2.7"""
import argparse

from .cmd import run
from .cmd import extractpipenv

def main():
    """Main function"""
    print("This version is not supported! It has limitted analysis features")
    parser = argparse.ArgumentParser(description='Analyze Jupyter Notebooks')
    subparsers = parser.add_subparsers()
    run.create_subparsers(subparsers)
    extractpipenv.create_subparsers(subparsers)

    args, rest = parser.parse_known_args()
    if not getattr(args, 'func', None):
        parser.print_help()
    else:
        args.func(args, rest)
