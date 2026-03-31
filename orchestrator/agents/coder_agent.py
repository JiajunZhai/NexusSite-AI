from __future__ import annotations

import json
import re
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from agents.llm_client import LLMError, OpenRouterClient
from tools.docker_tool import SandboxManager


CODER_SYSTEM_PROMPT = """You are the Coder Agent (Senior Frontend Architect) for NexusSite-AI.

## Mission
Generate production-grade Next.js (App Router) + Tailwind CSS code for a modern marketing site.

## Non-negotiable rules
- Only output code files. NO explanations, NO markdown fences.
- Output full file contents. NO diff/patch format.
- Use Tailwind CSS classes ONLY. Never use hardcode hex colors (like #6366f1).
- Use `lucide-react` icons where helpful.
- Prefer shadcn-style primitives from `@/components/ui/` when available.
- Ensure imports use `@/` alias where applicable.
- IMPORTANT: This repository uses the App Router at `app/` (NOT `src/app/`). Output paths under `app/`.
- WARNING: Never create a 'src' or 'pages' directory. Always write files into the 'app/' directory.
- ATOMIC: Do NOT write >50 lines of inline UI in `app/page.tsx`. Split into `components/` files.
- THEME: Read `theme_config` and use its color/style values via Tailwind classes.

## Output format (VERY STRICT)
You MUST output one or more file blocks in this exact format:

FILE: app/page.tsx
---CONTENT---
<FULL FILE CONTENT>
---END---

FILE: app/layout.tsx
---CONTENT---
<FULL FILE CONTENT>
---END---

No extra text outside these blocks.

## Few-shot example
FILE: app/page.tsx
---CONTENT---
export default function Page() {
  return <main className="min-h-screen p-8">Hello</main>;
}
---END---

## Context you will receive
- PRD JSON
- theme_config JSON (primary_color, component_style, etc.)
- QA error report (if this is a retry — FIX the reported issue)
"""

# Phase 2: Per-file generation prompt
FILE_CONTENT_PROMPT = """Write the FULL content of the file: {filepath}

Context:
- PRD: {prd_summary}
- theme_config: {theme_config}
- All files to create: {file_list}
{qa_error_context}

Rules:
- Only output the file content. NO explanations, NO markdown fences.
- Use Tailwind CSS. No hardcoded hex colors.
- Use `lucide-react` for icons.
- Use `@/` alias for imports.
- Keep the file focused and clean.

Output format:
FILE: {filepath}
---CONTENT---
<content>
---END---
"""


@dataclass
class CoderAgent:
    llm: OpenRouterClient = field(default_factory=OpenRouterClient)
    sandbox: SandboxManager = field(default_factory=SandboxManager)
    system_prompt: str = CODER_SYSTEM_PROMPT
    log_bus: Any = None  # Injected by state_machine coder_node

    _file_re = re.compile(r"^FILE:\s*(?P<path>.+?)\s*$", re.MULTILINE)

    def _parse_files(self, text: str) -> List[Tuple[str, str]]:
        files: List[Tuple[str, str]] = []
        if not text:
            return files
        idx = 0
        while True:
            m = self._file_re.search(text, idx)
            if not m:
                break
            path = m.group("path").strip()
            start = m.end()
            c1 = text.find("---CONTENT---", start)
            if c1 == -1:
                break
            c1_end = c1 + len("---CONTENT---")
            c2 = text.find("---END---", c1_end)
            if c2 == -1:
                break
            content = text[c1_end:c2].lstrip("\n").rstrip() + "\n"
            files.append((path, content))
            idx = c2 + len("---END---")
        return files

    def _call_llm_with_timeout(
        self,
        system: str,
        user: str,
        model_id: Optional[str],
        max_tokens: Optional[int],
        timeout_sec: int = 120,
    ) -> Optional[str]:
        """Call LLM with a hard timeout. Returns response text or None on failure."""
        result: List[Optional[str]] = [None]
        error_holder: List[Optional[Exception]] = [None]

        def _worker():
            try:
                resp = self.llm.chat(
                    system=system,
                    user=user,
                    temperature=0.2,
                    model=model_id,
                    max_tokens=max_tokens,
                )
                result[0] = resp.text
            except Exception as e:
                error_holder[0] = e

        t = threading.Thread(target=_worker, daemon=True)
        t.start()
        t.join(timeout=timeout_sec)

        if t.is_alive():
            print(f"[Coder] LLM call timed out after {timeout_sec}s")
            return None
        if error_holder[0]:
            print(f"[Coder] LLM call failed: {error_holder[0]}")
            return None
        return result[0]

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        print("[Coder] run() started — reading PRD and theme_config")
        prd = state.get("prd") or {}
        design_spec = state.get("design_spec") or {}
        theme_config = (
            design_spec.get("theme_config") if isinstance(design_spec, dict) else None
        )
        model_map = state.get("model_map") or {}
        model_id = model_map.get("coder") if isinstance(model_map, dict) else None
        deep_think = bool(state.get("deep_think") or False)

        # Check for QA error context (self-healing retry)
        qa_error = state.get("qa_error")
        test_reports = state.get("test_reports", []) or []
        if not qa_error and test_reports:
            last_report = test_reports[-1]
            if isinstance(last_report, dict) and last_report.get("error"):
                qa_error = last_report.get("error")

        print(f"[Coder] PRD project: {prd.get('project_name')}, theme: {theme_config}")
        if qa_error:
            print(f"[Coder] QA error detected (self-healing): {qa_error[:200]}")

        # Build file list from PRD
        pages = prd.get("pages", ["/"])
        file_list: List[str] = ["app/layout.tsx", "app/page.tsx"]
        for p in pages:
            if p != "/":
                safe_name = p.strip("/").replace("/", "-") or "page"
                file_list.append(f"app/{safe_name}/page.tsx")
        features = prd.get("features", [])
        for i, feat in enumerate(features[:5]):
            safe = (
                re.sub(r"[^a-zA-Z0-9]", "", feat.split()[0]) if feat else f"Section{i}"
            )
            if safe:
                file_list.append(f"components/{safe}.tsx")
        file_list.append("components/Footer.tsx")

        # Deduplicate
        file_list = list(dict.fromkeys(file_list))
        print(f"[Coder] File list ({len(file_list)} files): {file_list}")

        # Phase 2: Generate files in batches of 3 to balance speed and quality
        batch_size = 3
        all_parsed: List[Tuple[str, str]] = []
        prd_summary = json.dumps(
            {
                "project_name": prd.get("project_name"),
                "tagline": prd.get("tagline"),
                "pages": prd.get("pages"),
                "features": prd.get("features"),
            },
            ensure_ascii=False,
        )
        theme_json = (
            json.dumps(theme_config, ensure_ascii=False) if theme_config else "{}"
        )

        qa_error_context = ""
        if qa_error:
            qa_error_context = f"\n- QA ERROR TO FIX: {qa_error}\n  You MUST fix this issue in the generated code."

        for batch_start in range(0, len(file_list), batch_size):
            batch = file_list[batch_start : batch_start + batch_size]
            batch_end = min(batch_start + batch_size, len(file_list))

            # Publish progress via log_bus
            if self.log_bus:
                for filepath in batch:
                    self.log_bus.publish_event(
                        node_name="Coder",
                        kind="status",
                        message=f"正在生成 {filepath} ({batch_start + 1}/{len(file_list)})...",
                    )

            # Generate all files in this batch with one LLM call
            batch_prompt_parts = []
            for filepath in batch:
                batch_prompt_parts.append(
                    FILE_CONTENT_PROMPT.format(
                        filepath=filepath,
                        prd_summary=prd_summary,
                        theme_config=theme_json,
                        file_list=json.dumps(file_list, ensure_ascii=False),
                        qa_error_context=qa_error_context,
                    )
                )
            batch_user = "\n\n---\n\n".join(batch_prompt_parts)

            print(f"[Coder] Generating batch {batch_start // batch_size + 1}: {batch}")
            content_text = self._call_llm_with_timeout(
                system=self.system_prompt,
                user=batch_user,
                model_id=model_id,
                max_tokens=4000,
                timeout_sec=120,
            )

            if content_text:
                parsed = self._parse_files(content_text)
                if parsed:
                    all_parsed.extend(parsed)
                    print(f"[Coder] Parsed {len(parsed)} file(s) from batch")
                    continue

            # Fallback: try raw content for each file
            for filepath in batch:
                if content_text and not content_text.startswith("FILE:"):
                    all_parsed.append((filepath, content_text + "\n"))
                    print(f"[Coder] Used raw content for {filepath}")

        # Fallback if everything failed
        if not all_parsed:
            print("[Coder] All LLM calls failed, using fallback")
            all_parsed = [
                (
                    "app/page.tsx",
                    '"use client";\n\n'
                    "export default function Page() {\n"
                    '  return <main className="min-h-screen p-8 text-center"><h1 className="text-4xl font-bold">Hello</h1></main>;\n'
                    "}\n",
                ),
                (
                    "app/layout.tsx",
                    "export default function RootLayout({ children }: { children: React.ReactNode }) {\n"
                    '  return <html lang="en"><body>{children}</body></html>;\n'
                    "}\n",
                ),
            ]

        # Write files to sandbox
        code_files = dict(state.get("code_files") or {})
        for path, content in all_parsed:
            if path.startswith("src/"):
                path = path[len("src/") :]
            self.sandbox.write_file(path, content)
            code_files[path] = content
            print(f"[Coder] Written: {path} ({len(content)} bytes)")

        state["code_files"] = code_files
        print(f"[Coder] run() complete — {len(code_files)} files written")
        return state
