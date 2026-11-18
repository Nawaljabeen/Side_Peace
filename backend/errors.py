"""Typed errors. Catch these at the boundary."""


class SidePeaceError(Exception):
    """Base class for every expected SidePeace error."""


class StorageError(SidePeaceError):
    """The storage layer failed (cannot open, closed or locked database, constraint error)."""