import argparse

from .cmd import run

def main():
    print("This version is not supported! It has limitted analysis features")
    parser = argparse.ArgumentParser(description='Analyze Jupyter Notebooks')
    subparsers = parser.add_subparsers()
    run.create_subparsers(subparsers)
    
    args, rest = parser.parse_known_args()
    if not getattr(args, 'func', None):
        parser.print_help()
    else:
        args.func(args, rest)
