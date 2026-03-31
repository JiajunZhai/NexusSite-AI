from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, List, Union


@dataclass
class LogBus:
    """
    Tiny in-memory pub/sub for streaming logs to SSE/WebSocket clients.
    """

    _subscribers: List[asyncio.Queue[Dict[str, Any]]] = field(default_factory=list)

    def publish(self, line: str) -> None:
        """
        Backwards-compatible string publisher.
        """
        self.publish_event(node_name="RAW", kind="log", message=line)

    def publish_event(self, *, node_name: str, kind: str, message: str, data: Dict[str, Any] | None = None) -> None:
        evt: Dict[str, Any] = {
            "ts": int(time.time() * 1000),
            "node_name": node_name,
            "kind": kind,
            "message": message,
            "data": data or {},
        }
        for q in list(self._subscribers):
            try:
                q.put_nowait(evt)
            except Exception:
                pass

    async def subscribe(self) -> AsyncIterator[Dict[str, Any]]:
        q: asyncio.Queue[Dict[str, Any]] = asyncio.Queue(maxsize=200)
        self._subscribers.append(q)
        try:
            while True:
                evt = await q.get()
                yield evt
        finally:
            try:
                self._subscribers.remove(q)
            except ValueError:
                pass

