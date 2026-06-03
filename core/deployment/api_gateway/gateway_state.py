"""
SignVerse OS — Shared Gateway State
=====================================
Central module holding the live kernel and orchestrator references.
Imported by gateway.py and all API sub-routers that need kernel access.
Avoids circular imports by providing a late-binding accessor pattern.
"""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.os.kernel.signverse_kernel import SignVerseKernel

# These are populated by gateway.py at startup before any request arrives
kernel: "SignVerseKernel | None" = None

# Active sharing sessions: token -> {"created_at": float, "observers": dict, "operator_ws": WebSocket}
active_shares: dict = {}


def get_kernel() -> "SignVerseKernel":
    if kernel is None:
        raise RuntimeError("Kernel not initialised — gateway_state.kernel must be set at startup")
    return kernel

