from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from agents.llm_client import LLMError, OpenRouterClient
from tools.docker_tool import SandboxManager


@dataclass
class QAAgent:
    """
    QA agent that summarizes stderr into actionable developer suggestions.

    v1: runs `npm run build` in the workspace container, captures stderr,
    and (optionally) uses an LLM to summarize actionable suggestions.
    """

    llm: OpenRouterClient = OpenRouterClient()
    sandbox: SandboxManager = SandboxManager()

    QA_SYSTEM_PROMPT = """You are a QA engineer.

Input: raw build stderr text.
Output: ONLY valid JSON, no markdown, no commentary.

Schema:
{
  "error": "build_failed" | null,
  "summary": "one sentence",
  "suggestions": ["actionable fix 1", "actionable fix 2", "..."]
}

Rules:
- If stderr is empty, return error=null and empty suggestions.
- Suggestions must reference likely root causes and concrete edits (files, commands).
"""

    def analyze_stderr(self, stderr: str) -> Dict[str, Any]:
        s = (stderr or "").strip()
        if not s:
            return {"error": None, "summary": "Build succeeded.", "suggestions": [], "raw": ""}

        suggestions: List[str] = []

        lowered = s.lower()
        if "typescript" in lowered or "ts" in lowered:
            suggestions.append("运行 `npx tsc -p .` 定位首个 TypeScript 报错并逐个修复。")
        if "cannot find module" in lowered:
            suggestions.append("检查 import 路径与 `tsconfig.json` 的 `paths`/alias 配置，确认依赖已安装。")
        if "module not found" in lowered:
            suggestions.append("确认文件是否存在、大小写是否一致（Linux 容器大小写敏感），以及路径别名是否正确。")
        if "eslint" in lowered:
            suggestions.append("运行 `npm run lint` 查看具体规则与文件位置，按提示修复或调整配置。")
        if "next.config.ts" in lowered:
            suggestions.append("Next.js 14 不支持 `next.config.ts`，请改为 `next.config.js` 或 `next.config.mjs`。")
        if "tailwind" in lowered and ("postcss" in lowered or "unknown" in lowered):
            suggestions.append("检查 `postcss.config.*` 与 `tailwind.config.*` 是否匹配 Tailwind 版本，并确认内容扫描路径覆盖 `app/**/*`。")

        if not suggestions:
            suggestions.append("根据 stderr 首个错误栈定位到文件/行号，优先修复第一个错误再重试构建。")

        return {"error": "build_failed", "summary": "Build failed.", "suggestions": suggestions, "raw": s}

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        # Run real build in workspace container
        result = self.sandbox.run_command("npm run build", on_output=None)
        stderr = result.stderr or ""
        stdout = result.stdout or ""
        model_map = state.get("model_map") or {}
        model_id = model_map.get("qa") if isinstance(model_map, dict) else None
        deep_think = bool(state.get("deep_think") or False)

        if self.llm.is_configured() and stderr.strip():
            try:
                system = self.QA_SYSTEM_PROMPT
                if deep_think:
                    system = system + "\n\nExtra: Think step by step and include precise file/line fixes."
                resp = self.llm.chat(system=system, user=stderr, temperature=0.1, model=model_id, max_tokens=(1200 if deep_think else None))
                report = __import__("json").loads(resp.text.strip())
                # Preserve raw logs
                report["raw"] = stderr
                report["stdout"] = stdout
                report["exit_code"] = result.exit_code
            except (LLMError, Exception):
                report = self.analyze_stderr(stderr)
                report["stdout"] = stdout
                report["exit_code"] = result.exit_code
        else:
            report = self.analyze_stderr(stderr)
            report["stdout"] = stdout
            report["exit_code"] = result.exit_code

        reports = list(state.get("test_reports") or [])
        reports.append(report)
        state["test_reports"] = reports

        # Increment retry_count if build failed (cap at 3 for UI)
        retry_count = int(state.get("retry_count", 0) or 0)
        if report.get("error"):
            state["retry_count"] = min(retry_count + 1, 3)
        else:
            state["retry_count"] = retry_count

        return state

