import asyncio

import pytest

from database.write_queue import WriteQueue
from errors import StorageError


@pytest.fixture
async def queue():
    write_queue = WriteQueue()
    yield write_queue
    await write_queue.stop()


async def test_submit_returns_the_job_result(queue):
    async def job():
        return 42

    assert await queue.submit(job) == 42


async def test_jobs_never_overlap(queue):
    running = 0
    max_running = 0

    async def job():
        nonlocal running, max_running
        running += 1
        max_running = max(max_running, running)
        await asyncio.sleep(0)  # give other jobs a chance to start if they could
        running -= 1

    await asyncio.gather(*(queue.submit(job) for _ in range(50)))

    assert max_running == 1


async def test_jobs_run_in_submission_order(queue):
    order = []

    def make_job(number):
        async def job():
            await asyncio.sleep(0)
            order.append(number)

        return job

    await asyncio.gather(*(queue.submit(make_job(n)) for n in range(50)))

    assert order == list(range(50))


async def test_failing_job_raises_to_its_caller_and_the_worker_survives(queue):
    async def bad_job():
        raise StorageError("boom")

    async def good_job():
        return "still alive"

    with pytest.raises(StorageError):
        await queue.submit(bad_job)

    assert await queue.submit(good_job) == "still alive"


async def test_stop_waits_for_pending_jobs(queue):
    finished = []

    async def slow_job():
        await asyncio.sleep(0.01)
        finished.append(True)

    pending = asyncio.create_task(queue.submit(slow_job))
    await asyncio.sleep(0)  # let the job reach the queue

    await queue.stop()

    assert finished == [True]
    await pending


async def test_queue_can_be_used_again_after_stop(queue):
    async def job():
        return "again"

    await queue.submit(job)
    await queue.stop()

    assert await queue.submit(job) == "again"