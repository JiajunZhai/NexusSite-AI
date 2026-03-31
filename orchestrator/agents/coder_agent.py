from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from agents.llm_client import LLMError, OpenRouterClient
from tools.docker_tool import SandboxManager


CODER_SYSTEM_PROMPT = """You are the Coder Agent (Senior Engineer) for NexusSite-AI.

## Mission
Generate **production-grade Next.js (App Router) + Tailwind CSS** code for a modern SaaS-style marketing site.

## Non-negotiable rules
- Only output code files. NO explanations.
- Output full file contents. NO diff/patch format.
- Use Tailwind CSS classes.
- Use `lucide-react` icons where helpful.
- Prefer shadcn-style primitives from `@/components/ui/` when available.
- Ensure imports use `@/` alias where applicable.
- IMPORTANT: This repository uses the App Router at `app/` (NOT `src/app/`). Output paths under `app/` unless explicitly instructed otherwise.
- WARNING: Never create a 'src' or 'pages' directory. Always write files into the 'app/' directory at the root. Use App Router conventions ONLY.

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
- theme_config JSON
- prior test reports (optional)
"""


@dataclass
class CoderAgent:
    llm: OpenRouterClient = OpenRouterClient()
    sandbox: SandboxManager = SandboxManager()
    system_prompt: str = CODER_SYSTEM_PROMPT

    _file_re = re.compile(r"^FILE:\s*(?P<path>.+?)\s*$", re.MULTILINE)

    def _parse_files(self, text: str) -> List[Tuple[str, str]]:
        """
        Parse FILE blocks:
        FILE: <path>
        ---CONTENT---
        <content>
        ---END---
        """
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

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        prd = state.get("prd") or {}
        theme_config = (state.get("design_spec") or {}).get("theme_config") if isinstance(state.get("design_spec"), dict) else None
        model_map = state.get("model_map") or {}
        model_id = model_map.get("coder") if isinstance(model_map, dict) else None
        deep_think = bool(state.get("deep_think") or False)

        user_payload = json.dumps(
            {
                "prd": prd,
                "theme_config": theme_config,
                "reflector_notes": state.get("reflector_notes"),
                "test_reports": state.get("test_reports", []),
            },
            ensure_ascii=False,
            indent=2,
        )

        if self.llm.is_configured():
            try:
                system = self.system_prompt
                if deep_think:
                    system = system + "\n\n## Deep Thinking\nThink step by step. Validate assumptions. Prefer simple, reliable implementations.\n"
                resp = self.llm.chat(system=system, user=user_payload, temperature=0.2, model=model_id, max_tokens=(3000 if deep_think else None))
                raw_text = resp.text
                parsed = self._parse_files(raw_text)
            except LLMError:
                parsed = []
        else:
            # Offline fallback: buildable interactive page so pipeline stays runnable
            parsed = [
                (
                    "app/page.tsx",
                    "\"use client\";\n"
                    "\n"
                    "import { useEffect, useMemo, useRef, useState } from \"react\";\n"
                    "\n"
                    "function formatMMSS(totalSeconds: number) {\n"
                    "  const s = Math.max(0, Math.floor(totalSeconds));\n"
                    "  const mm = String(Math.floor(s / 60)).padStart(2, \"0\");\n"
                    "  const ss = String(s % 60).padStart(2, \"0\");\n"
                    "  return `${mm}:${ss}`;\n"
                    "}\n"
                    "\n"
                    "export default function Page() {\n"
                    "  const DEFAULT_SECONDS = 5 * 60;\n"
                    "  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);\n"
                    "  const [running, setRunning] = useState(false);\n"
                    "  const intervalRef = useRef<number | null>(null);\n"
                    "\n"
                    "  const label = useMemo(() => (running ? \"暂停\" : \"开始\"), [running]);\n"
                    "\n"
                    "  useEffect(() => {\n"
                    "    if (!running) return;\n"
                    "    intervalRef.current = window.setInterval(() => {\n"
                    "      setSecondsLeft((s) => {\n"
                    "        if (s <= 1) return 0;\n"
                    "        return s - 1;\n"
                    "      });\n"
                    "    }, 1000);\n"
                    "    return () => {\n"
                    "      if (intervalRef.current) window.clearInterval(intervalRef.current);\n"
                    "      intervalRef.current = null;\n"
                    "    };\n"
                    "  }, [running]);\n"
                    "\n"
                    "  useEffect(() => {\n"
                    "    if (secondsLeft === 0) setRunning(false);\n"
                    "  }, [secondsLeft]);\n"
                    "\n"
                    "  return (\n"
                    "    <main className=\"min-h-screen w-full bg-zinc-900 text-lime-300 flex items-center justify-center p-6\">\n"
                    "      <div className=\"w-full max-w-md border border-lime-300/30 rounded-2xl p-8 bg-zinc-950/40 backdrop-blur\">\n"
                    "        <header className=\"space-y-2\">\n"
                    "          <h1 className=\"text-2xl font-semibold tracking-tight\">极简倒计时</h1>\n"
                    "          <p className=\"text-sm text-lime-200/70\">深灰背景 · 亮绿色文字 · 开始/暂停</p>\n"
                    "        </header>\n"
                    "\n"
                    "        <div className=\"mt-8 flex items-end justify-between\">\n"
                    "          <div className=\"text-6xl font-bold tabular-nums\">{formatMMSS(secondsLeft)}</div>\n"
                    "          <div className=\"text-xs text-lime-200/60\">默认 05:00</div>\n"
                    "        </div>\n"
                    "\n"
                    "        <div className=\"mt-8 flex gap-3\">\n"
                    "          <button\n"
                    "            type=\"button\"\n"
                    "            onClick={() => setRunning((r) => !r)}\n"
                    "            className=\"flex-1 rounded-xl bg-lime-300 text-zinc-950 font-semibold py-3 hover:bg-lime-200 active:bg-lime-400 transition\"\n"
                    "          >\n"
                    "            {label}\n"
                    "          </button>\n"
                    "          <button\n"
                    "            type=\"button\"\n"
                    "            onClick={() => {\n"
                    "              setRunning(false);\n"
                    "              setSecondsLeft(DEFAULT_SECONDS);\n"
                    "            }}\n"
                    "            className=\"rounded-xl border border-lime-300/30 text-lime-200 py-3 px-4 hover:bg-lime-300/10 active:bg-lime-300/15 transition\"\n"
                    "          >\n"
                    "            重置\n"
                    "          </button>\n"
                    "        </div>\n"
                    "\n"
                    "        <footer className=\"mt-8 text-xs text-lime-200/50\">\n"
                    "          提示：到 00:00 会自动停止。\n"
                    "        </footer>\n"
                    "      </div>\n"
                    "    </main>\n"
                    "  );\n"
                    "}\n",
                )
            ]

        if not parsed:
            # Fallback when LLM is rate-limited/truncated/unparseable
            parsed = [
                (
                    "app/page.tsx",
                    "\"use client\";\n"
                    "\n"
                    "import { useEffect, useMemo, useRef, useState } from \"react\";\n"
                    "\n"
                    "function formatMMSS(totalSeconds: number) {\n"
                    "  const s = Math.max(0, Math.floor(totalSeconds));\n"
                    "  const mm = String(Math.floor(s / 60)).padStart(2, \"0\");\n"
                    "  const ss = String(s % 60).padStart(2, \"0\");\n"
                    "  return `${mm}:${ss}`;\n"
                    "}\n"
                    "\n"
                    "export default function Page() {\n"
                    "  const DEFAULT_SECONDS = 5 * 60;\n"
                    "  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);\n"
                    "  const [running, setRunning] = useState(false);\n"
                    "  const intervalRef = useRef<number | null>(null);\n"
                    "\n"
                    "  const label = useMemo(() => (running ? \"暂停\" : \"开始\"), [running]);\n"
                    "\n"
                    "  useEffect(() => {\n"
                    "    if (!running) return;\n"
                    "    intervalRef.current = window.setInterval(() => {\n"
                    "      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));\n"
                    "    }, 1000);\n"
                    "    return () => {\n"
                    "      if (intervalRef.current) window.clearInterval(intervalRef.current);\n"
                    "      intervalRef.current = null;\n"
                    "    };\n"
                    "  }, [running]);\n"
                    "\n"
                    "  useEffect(() => {\n"
                    "    if (secondsLeft === 0) setRunning(false);\n"
                    "  }, [secondsLeft]);\n"
                    "\n"
                    "  return (\n"
                    "    <main className=\\\"min-h-screen w-full bg-zinc-900 text-lime-300 flex items-center justify-center p-6\\\">\n"
                    "      <div className=\\\"w-full max-w-md border border-lime-300/30 rounded-2xl p-8 bg-zinc-950/40 backdrop-blur\\\">\n"
                    "        <header className=\\\"space-y-2\\\">\n"
                    "          <h1 className=\\\"text-2xl font-semibold tracking-tight\\\">极简倒计时</h1>\n"
                    "          <p className=\\\"text-sm text-lime-200/70\\\">深灰背景 · 亮绿色文字 · 开始/暂停</p>\n"
                    "        </header>\n"
                    "\n"
                    "        <div className=\\\"mt-8 flex items-end justify-between\\\">\n"
                    "          <div className=\\\"text-6xl font-bold tabular-nums\\\">{formatMMSS(secondsLeft)}</div>\n"
                    "          <div className=\\\"text-xs text-lime-200/60\\\">默认 05:00</div>\n"
                    "        </div>\n"
                    "\n"
                    "        <div className=\\\"mt-8 flex gap-3\\\">\n"
                    "          <button\n"
                    "            type=\\\"button\\\"\n"
                    "            onClick={() => setRunning((r) => !r)}\n"
                    "            className=\\\"flex-1 rounded-xl bg-lime-300 text-zinc-950 font-semibold py-3 hover:bg-lime-200 active:bg-lime-400 transition\\\"\n"
                    "          >\n"
                    "            {label}\n"
                    "          </button>\n"
                    "          <button\n"
                    "            type=\\\"button\\\"\n"
                    "            onClick={() => { setRunning(false); setSecondsLeft(DEFAULT_SECONDS); }}\n"
                    "            className=\\\"rounded-xl border border-lime-300/30 text-lime-200 py-3 px-4 hover:bg-lime-300/10 active:bg-lime-300/15 transition\\\"\n"
                    "          >\n"
                    "            重置\n"
                    "          </button>\n"
                    "        </div>\n"
                    "\n"
                    "        <footer className=\\\"mt-8 text-xs text-lime-200/50\\\">提示：到 00:00 会自动停止。</footer>\n"
                    "      </div>\n"
                    "    </main>\n"
                    "  );\n"
                    "}\n",
                )
            ]

        code_files = dict(state.get("code_files") or {})
        for path, content in parsed:
            # Normalize away `src/` to avoid mixed directory structures in this repo.
            if path.startswith("src/"):
                path = path[len("src/") :]
            # write to sandbox (workspace bind mount)
            self.sandbox.write_file(path, content)
            code_files[path] = content

        state["code_files"] = code_files
        return state

