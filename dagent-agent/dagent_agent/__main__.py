"""Entry point for the dagent-agent runtime.

Two modes:

- Long-lived (default): ``python -m dagent_agent`` runs the polling executor
  that processes all pending tasks across all requirements. Use this for the
  shared, always-on deployment (the current ``start.sh`` dev setup and the
  future long-lived ``Deployment``).

- Single-requirement: ``python -m dagent_agent --requirement-id 42`` processes
  only the tasks for requirement 42 and then exits. Use this for the
  per-requirement container model where each Pod handles one requirement's
  current stage and exits at a human gate; the next stage spawns a fresh Pod.
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from dagent_agent.config import settings
from dagent_agent.executor.runner import Runner


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="dagent_agent",
        description="Dagent agent runtime: poll the backend for tasks and execute them.",
    )
    parser.add_argument(
        "--requirement-id",
        type=int,
        default=None,
        help="If set, run in single-requirement mode: process only this "
        "requirement's tasks and exit when none remain. If omitted, run the "
        "long-lived polling loop (processes all pending tasks).",
    )
    parser.add_argument(
        "--max-idle-polls",
        type=int,
        default=12,
        help="In single-requirement mode, exit after this many consecutive "
        "polls with no matching task (default 12). Ignored in long-lived mode.",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)

    runner = Runner()
    try:
        if args.requirement_id is not None:
            asyncio.run(runner.run_single(args.requirement_id, args.max_idle_polls))
        else:
            asyncio.run(runner.run_forever())
    except KeyboardInterrupt:
        logging.getLogger(__name__).info("runner stopped by user")


if __name__ == "__main__":
    main()
