"""Module with functions to operate processes"""
import asyncio
import subprocess

from asyncio.subprocess import PIPE as APIPE
from subprocess import CalledProcessError, CompletedProcess

NOP = lambda x: None


async def read_stream_and_display(stream, display):
    """Read from stream line by line until EOF, display, and capture the lines."""
    #import IPython; IPython.embed()
    output = []
    while True:
        group = (await stream.read(79))
        if not group:
            break
        output.append(group)
        display(group) # assume it doesn't block
    return b''.join(output)


async def async_run(args, out_display=NOP, err_display=NOP, check=False, **kwargs):
    """Run process asynchronously"""
    process = await asyncio.create_subprocess_exec(
        *args, stdout=APIPE, stderr=APIPE, **kwargs)

    # read child's stdout/stderr concurrently (capture and display)
    try:
        stdout, stderr = await asyncio.gather(
            read_stream_and_display(process.stdout, out_display),
            read_stream_and_display(process.stderr, err_display))
    except Exception:
        process.kill()
        raise
    finally:
        # wait for the process to exit
        retcode = await process.wait()
    if check and retcode:
        raise CalledProcessError(retcode, args,
                                 output=stdout, stderr=stderr)

    return CompletedProcess(args, retcode, stdout, stderr)


def sync_run(args, **kwargs):
    """Run process synchronously"""
    # pylint: disable=subprocess-run-check
    return subprocess.run(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        **kwargs
    )


def printout(value):
    """Print to stdout"""
    try:
        print(value.strip().decode("utf-8"))
    except UnicodeDecodeError:
        print("printout DecodeError:", value)


def printerr(value):
    """Print to stderr"""
    try:
        print(value.strip().decode("utf-8"))
    except UnicodeDecodeError:
        print("printout DecodeError:", value)
