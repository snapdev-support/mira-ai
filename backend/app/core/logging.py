from __future__ import annotations

import logging
import sys
from typing import Optional


def configure_logging(level: str = "INFO") -> None:
    # Keep it simple: single stdout handler. Routers/services can emit JSON strings.
    root = logging.getLogger()
    if getattr(root, "_mira_configured", False):
        return

    numeric = getattr(logging, (level or "INFO").upper(), logging.INFO)
    root.setLevel(numeric)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric)
    handler.setFormatter(logging.Formatter("%(message)s"))

    # Clear any default handlers to avoid duplicate logs in reload.
    root.handlers = [handler]
    root.propagate = False
    setattr(root, "_mira_configured", True)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    return logging.getLogger(name or "mira")
