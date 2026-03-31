from __future__ import annotations

import json
import os
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Any, Dict, Optional


class LLMError(RuntimeError):
    pass


@dataclass(frozen=True)
class LLMResponse:
    text: str
    raw: Dict[str, Any]


@dataclass
class OpenRouterClient:
    """
    Minimal OpenRouter chat client (no external deps).

    Env vars:
    - OPENROUTER_API_KEY
    - OPENROUTER_MODEL (default: "meta-llama/llama-3.1-8b-instruct:free")
    - OPENROUTER_BASE_URL (default: "https://openrouter.ai/api/v1")
    - OPENROUTER_APP_NAME (optional)
    - OPENROUTER_HTTP_REFERER (optional)
    """

    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: str = "https://openrouter.ai/api/v1"

    def __post_init__(self) -> None:
        if self.api_key is None:
            self.api_key = os.getenv("OPENROUTER_API_KEY")
        if self.model is None:
            self.model = os.getenv(
                "OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free"
            )
        base = os.getenv("OPENROUTER_BASE_URL")
        if base:
            self.base_url = base.rstrip("/")

    def is_configured(self) -> bool:
        return bool(self.api_key and self.model)

    def chat(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.2,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> LLMResponse:
        chosen_model = (model or self.model or "").strip()
        if chosen_model.startswith("opencode/"):
            return _chat_opencode_zen(
                model_id=chosen_model,
                system=system,
                user=user,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        if not self.is_configured():
            raise LLMError(
                "OpenRouter is not configured (missing OPENROUTER_API_KEY or OPENROUTER_MODEL)."
            )

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # OpenRouter policy: strongly recommended (and sometimes required) to send
        # both HTTP-Referer and X-Title for higher rate limits and compliance.
        app_name = (
            os.getenv("OPENROUTER_APP_NAME") or os.getenv("X_TITLE") or "NexusSite-AI"
        )
        http_referer = (
            os.getenv("OPENROUTER_HTTP_REFERER")
            or os.getenv("HTTP_REFERER")
            or "http://localhost:3002"
        )
        headers["X-Title"] = app_name
        headers["HTTP-Referer"] = http_referer

        payload = {
            "model": model or self.model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if max_tokens is not None:
            payload["max_tokens"] = int(max_tokens)

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:  # pragma: no cover
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")
            except Exception:
                body = ""
            raise LLMError(f"OpenRouter HTTP {e.code}: {body or e.reason}") from e
        except Exception as e:  # pragma: no cover
            raise LLMError(f"OpenRouter request failed: {e}") from e

        try:
            text = raw["choices"][0]["message"]["content"] or ""
        except Exception as e:  # pragma: no cover
            raise LLMError(f"Unexpected OpenRouter response: {raw}") from e

        return LLMResponse(text=text, raw=raw)


def _chat_opencode_zen(
    *,
    model_id: str,
    system: str,
    user: str,
    temperature: float,
    max_tokens: Optional[int],
) -> LLMResponse:
    """
    OpenCode Zen gateway.
    Docs: https://opencode.ai/docs/zen/

    OpenCode model ids are in the form "opencode/<model-id>".
    """
    api_key = os.getenv("OPENCODE_ZEN_API_KEY") or ""
    if not api_key:
        raise LLMError("OpenCode Zen is not configured (missing OPENCODE_ZEN_API_KEY).")

    inner = model_id.split("/", 1)[1] if "/" in model_id else model_id
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # Claude models use Anthropic-compatible messages endpoint.
    if inner.startswith("claude-"):
        url = "https://opencode.ai/zen/v1/messages"
        payload: Dict[str, Any] = {
            "model": inner,
            "max_tokens": int(max_tokens or 2048),
            "temperature": float(temperature),
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:  # pragma: no cover
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")
            except Exception:
                body = ""
            raise LLMError(f"OpenCode Zen HTTP {e.code}: {body or e.reason}") from e
        except Exception as e:  # pragma: no cover
            raise LLMError(f"OpenCode Zen request failed: {e}") from e

        # Anthropic format: content is a list of blocks; join text blocks.
        try:
            blocks = raw.get("content") or []
            if isinstance(blocks, list):
                text = "".join(b.get("text", "") for b in blocks if isinstance(b, dict))
            else:
                text = str(blocks)
        except Exception as e:  # pragma: no cover
            raise LLMError(f"Unexpected OpenCode Zen response: {raw}") from e
        return LLMResponse(text=text, raw=raw)

    # Default: OpenAI-compatible chat completions.
    url = "https://opencode.ai/zen/v1/chat/completions"
    payload = {
        "model": inner,
        "temperature": float(temperature),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if max_tokens is not None:
        payload["max_tokens"] = int(max_tokens)

    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:  # pragma: no cover
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        raise LLMError(f"OpenCode Zen HTTP {e.code}: {body or e.reason}") from e
    except Exception as e:  # pragma: no cover
        raise LLMError(f"OpenCode Zen request failed: {e}") from e

    try:
        text = raw["choices"][0]["message"]["content"] or ""
    except Exception as e:  # pragma: no cover
        raise LLMError(f"Unexpected OpenCode Zen response: {raw}") from e
    return LLMResponse(text=text, raw=raw)
