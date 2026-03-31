from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from agents.llm_client import LLMError, OpenRouterClient


PM_SYSTEM_PROMPT = """You are a senior Product Manager (PM Agent).

## Goal
Turn a vague user request into a concrete, buildable website plan.

## Hard rules (IMPORTANT)
- Do NOT write code.
- ONLY output valid JSON (no markdown, no commentary).
- The JSON MUST contain exactly these top-level keys:
  - project_name: string
  - pages: array of route paths (strings, must start with "/")
  - features: array of feature bullet points (strings)
  - user_flow: array of steps (strings)
- Keep scope realistic: marketing site, 1-5 pages.

## Few-shot examples
USER: "Make a landing page for an AI note app with pricing"
OUTPUT:
{
  "project_name": "AI Note",
  "pages": ["/", "/pricing"],
  "features": ["Hero + value proposition", "Pricing tiers", "FAQ section", "Call-to-action"],
  "user_flow": ["User lands on /", "User scans benefits", "User checks pricing", "User clicks CTA"]
}

USER: "Portfolio site for a freelance designer"
OUTPUT:
{
  "project_name": "Designer Portfolio",
  "pages": ["/", "/work", "/about", "/contact"],
  "features": ["Project gallery", "Case study cards", "About section", "Contact form CTA"],
  "user_flow": ["User lands on /", "User views /work", "User reads /about", "User goes to /contact"]
}
"""


def _safe_json_load(s: str) -> Dict[str, Any]:
    return json.loads(s.strip())


@dataclass
class PMAgent:
    llm: OpenRouterClient = OpenRouterClient()

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        messages = state.get("messages") or []
        user_text = ""
        for m in reversed(messages):
            # Support both dict-based messages and langchain HumanMessage
            if isinstance(m, dict) and m.get("role") == "user":
                user_text = str(m.get("content") or "")
                break
            if hasattr(m, "content"):
                user_text = str(getattr(m, "content") or "")
                if user_text:
                    break
        if not user_text:
            user_text = str(state.get("user_request") or "Create a simple marketing website.")

        model_map = state.get("model_map") or {}
        model_id = model_map.get("pm") if isinstance(model_map, dict) else None
        deep_think = bool(state.get("deep_think") or False)
        max_tokens = 1400 if deep_think else None

        if self.llm.is_configured():
            try:
                resp = self.llm.chat(system=PM_SYSTEM_PROMPT, user=user_text, temperature=0.2, model=model_id, max_tokens=max_tokens)
                prd = _safe_json_load(resp.text)
            except (LLMError, json.JSONDecodeError):
                prd = None
        else:
            # Offline fallback for deterministic flow
            prd = {
                "project_name": "NexusSite-AI Demo",
                "pages": ["/"],
                "features": ["Hero section", "Feature highlights", "CTA section"],
                "user_flow": ["User lands on /", "User scans features", "User clicks CTA"],
            }

        if not prd:
            prd = {
                "project_name": "NexusSite-AI Demo",
                "pages": ["/"],
                "features": ["Hero section", "Feature highlights", "CTA section"],
                "user_flow": ["User lands on /", "User scans features", "User clicks CTA"],
            }

        state["prd"] = prd
        return state

