"""Typed errors. Catch these at the boundary."""


class SidePeaceError(Exception):
    """Base class for every expected SidePeace error."""


class StorageError(SidePeaceError):
    """The storage layer failed (cannot open, closed or locked database, constraint error)."""

class ProviderError(SidePeaceError):
    """The external LLM provider failed. Subclasses say how."""


class ProviderTimeoutError(ProviderError):
    """The provider did not answer in time."""


class ProviderRateLimitError(ProviderError):
    """The provider refused the request because we are over its rate limit."""


class ProviderBadResponseError(ProviderError):
    """The provider was unreachable, rejected the request, or returned an unusable answer."""


class ConfigError(SidePeaceError):
    """A setting is missing or invalid. Raised at start-up, before the server accepts requests."""