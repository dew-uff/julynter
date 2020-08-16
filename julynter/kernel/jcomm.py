"""Define a Comm for Julynter"""
from ipykernel.comm import Comm

class JulynterComm(object):
    """Julynter comm hadler"""
    # pylint: disable=useless-object-inheritance

    def __init__(self, shell=None):
        self.shell = shell
        self.name = 'julynter.comm'
        self.comm = None

    def register(self):
        """Register comm"""
        self.comm = Comm(self.name)
        self.comm.on_msg(self.receive)
        self.send({'operation': 'init'})

    def receive(self, msg):
        """Receive lint request"""

    def send(self, data):
        """Receive send results"""
        self.comm.send(data)
