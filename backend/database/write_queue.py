"""Single-consumer write queue

Callers submit async jobs; exactly one worker task runs them one at a time, in submission
order. Two writes can therefore never overlap, so no locks are needed around the database.
The worker starts lazily on the first submit, because it needs a running event loop.
"""
import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


class WriteQueue:
    def __init__(self) -> None:
        self._queue: asyncio.Queue = asyncio.Queue()
        self._worker: asyncio.Task | None = None

    async def submit(self, job: Callable[[], Awaitable[T]]) -> T:
        """Queue a job and wait for its result (or its exception)."""
        self._ensure_worker()
        future = asyncio.get_running_loop().create_future()
        await self._queue.put((job, future))
        return await future

    async def stop(self) -> None:
        """Wait for queued jobs to finish, then stop the worker. submit() may restart it."""
        await self._queue.join()
        if self._worker is not None:
            self._worker.cancel()
            await asyncio.gather(self._worker, return_exceptions=True)
            self._worker = None

    def _ensure_worker(self) -> None:
        if self._worker is None or self._worker.done():
            self._worker = asyncio.create_task(self._run())

    async def _run(self) -> None:
        while True:
            job, future = await self._queue.get()
            try:
                result = await job()
            except Exception as exc:  # forwarded to the awaiting caller; one failed job must not kill the worker
                if not future.done():
                    future.set_exception(exc)
            else:
                if not future.done():
                    future.set_result(result)
            finally:
                self._queue.task_done()