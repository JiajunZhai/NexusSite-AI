from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict

from agents.llm_client import LLMError, OpenRouterClient


DESIGNER_SYSTEM_PROMPT = """You are a UI/UX Designer (Designer Agent).

## Goal
Given a PRD (website pages + features), produce a Tailwind-friendly theme configuration and style guide.

## Hard rules
- ONLY output valid JSON (no markdown, no commentary).
- Output MUST be a JSON object named `theme_config` with EXACT keys:
  - primary_color: string (hex, e.g. "#7c3aed")
  - font_family: string (CSS font-family)
  - spacing_scale: object (keys: xs, sm, md, lg, xl with numeric px values)
  - component_style: string (one of: "rounded", "minimalist", "sharp", "luxury")

## Few-shot examples
INPUT PRD:
{"project_name":"AI Note","pages":["/","/pricing"],"features":["Hero","Pricing"],"user_flow":["/ -> /pricing -> CTA"]}
OUTPUT:
{
  "theme_config": {
    "primary_color": "#7c3aed",
    "font_family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    "spacing_scale": {"xs": 8, "sm": 12, "md": 16, "lg": 24, "xl": 32},
    "component_style": "rounded"
  }
}
"""


@dataclass
class DesignerAgent:
    llm: OpenRouterClient = OpenRouterClient()

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        prd = state.get("prd") or {}
        model_map = state.get("model_map") or {}
        model_id = model_map.get("designer") if isinstance(model_map, dict) else None
        deep_think = bool(state.get("deep_think") or False)
        max_tokens = 1200 if deep_think else None

        if self.llm.is_configured():
            try:
                resp = self.llm.chat(
                    system=DESIGNER_SYSTEM_PROMPT,
                    user=json.dumps(prd, ensure_ascii=False),
                    temperature=0.2,
                    model=model_id,
                    max_tokens=max_tokens,
                )
                design = json.loads(resp.text.strip())
                theme_config = design.get("theme_config") if isinstance(design, dict) else None
            except (LLMError, json.JSONDecodeError):
                theme_config = None
        else:
            theme_config = {
                "primary_color": "#7c3aed",
                "font_family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
                "spacing_scale": {"xs": 8, "sm": 12, "md": 16, "lg": 24, "xl": 32},
                "component_style": "rounded",
            }

        if not theme_config:
            theme_config = {
                "primary_color": "#7c3aed",
                "font_family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
                "spacing_scale": {"xs": 8, "sm": 12, "md": 16, "lg": 24, "xl": 32},
                "component_style": "rounded",
            }

        state["design_spec"] = {"theme_config": theme_config}
        return state

