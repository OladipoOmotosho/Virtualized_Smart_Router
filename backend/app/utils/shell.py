"""Safe subprocess wrapper for all privileged Linux commands.

All iptables, tcpdump, and ip-netns calls go through run() or run_async().
Never build commands with f-strings from user input — always use argument lists.
"""

import asyncio
import logging
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)


def run(
    cmd: list[str],
    check: bool = True,
    capture_output: bool = True,
    timeout: Optional[int] = 30,
) -> subprocess.CompletedProcess:
    """Run a shell command synchronously as an argument list (no shell=True).

    Raises subprocess.CalledProcessError on non-zero exit if check=True.
    """
    logger.debug("shell.run: %s", cmd)
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture_output,
        timeout=timeout,
    )


async def run_async(
    cmd: list[str],
    check: bool = True,
    capture_output: bool = True,
    timeout: Optional[int] = 30,
) -> subprocess.CompletedProcess:
    """Offload run() to a thread so it never blocks the asyncio event loop."""
    return await asyncio.to_thread(run, cmd, check, capture_output, timeout)


def popen(cmd: list[str]) -> subprocess.Popen:
    """Start a long-running background process (e.g. tcpdump) and return the handle."""
    logger.debug("shell.popen: %s", cmd)
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
