from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict

from agents.llm_client import LLMError, OpenRouterClient


REFLECTOR_SYSTEM_PROMPT = """You are the Reflector Agent (Senior Architect).

## Goal
Given the PRD and theme_config, produce a short implementation plan and key risks.

## Hard rules
- Do NOT write code.
- Output ONLY valid JSON (no markdown, no commentary).
- JSON schema:
{
  "plan": ["step 1", "step 2", "..."],
  "risks": ["risk 1", "risk 2", "..."],
  "notes_for_coder": "short guidance string"
}

## Guidance
- Think step by step.
- Prefer stable Next.js App Router patterns.
- Keep it concise: <= 10 plan items.
"""


@dataclass
class ReflectorAgent:
    llm: OpenRouterClient = OpenRouterClient()

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        prd = state.get("prd") or {}
        theme_config = (
            (state.get("design_spec") or {}).get("theme_config")
            if isinstance(state.get("design_spec"), dict)
            else None
        )

        payload = json.dumps({"prd": prd, "theme_config": theme_config}, ensure_ascii=False)

        model_map = state.get("model_map") or {}
        model_id = model_map.get("coder") if isinstance(model_map, dict) else None
        deep_think = bool(state.get("deep_think") or False)

        if self.llm.is_configured():
            try:
                resp = self.llm.chat(
                    system=REFLECTOR_SYSTEM_PROMPT,
                    user=payload,
                    temperature=0.2,
                    model=model_id,
                    max_tokens=1400 if deep_think else 900,
                )
                obj = json.loads(resp.text.strip())
                notes = obj.get("notes_for_coder") if isinstance(obj, dict) else None
                if not isinstance(notes, str):
                    notes = resp.text.strip()
            except (LLMError, Exception):
                notes = None
        else:
            notes = None

        if not notes:
            notes = "实现建议：先搭页面骨架与全局布局，再补各区块组件，最后修 TypeScript/Next build 错误。"

        state["reflector_notes"] = notes
        return state

