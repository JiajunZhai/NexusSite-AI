from __future__ import annotations

import json
from typing import Any, Dict, List

from workflow.state_machine import graph


def divider(title: str) -> None:
    print("\n" + "#" * 88)
    print(title)
    print("#" * 88)


def summarize_prd(prd: Any) -> str:
    if not isinstance(prd, dict):
        return f"(invalid prd type: {type(prd).__name__}) {prd}"
    name = prd.get("project_name")
    pages = prd.get("pages")
    features = prd.get("features")
    return f"project_name={name} | pages={pages} | features={features}"


def main() -> int:
    user_request = "帮我做一个极简风格的倒计时工具页面。背景用深灰色，文字用亮绿色。包含一个开始/暂停按钮。"

    state: Dict[str, Any] = {
        "messages": [{"role": "user", "content": user_request}],
        "code_files": {},
        "test_reports": [],
        "retry_count": 0,
    }

    divider("FULL CHAIN TEST: PM -> Designer -> Coder -> QA (with retry loop)")
    print("[User Input]", user_request)

    written_paths: List[str] = []
    last_code_files_keys: set[str] = set()

    # Stream through the graph and print node transitions.
    for event in graph.stream(state):
        node = next(iter(event.keys()))
        payload = event[node]

        divider(f"[Node: {node}] Starting...")

        if isinstance(payload, dict):
            # Track file writes by observing newly appearing keys in code_files
            code_files = payload.get("code_files") or {}
            if isinstance(code_files, dict):
                keys = set(code_files.keys())
                new_keys = sorted(list(keys - last_code_files_keys))
                if new_keys:
                    written_paths.extend(new_keys)
                    print("[Coder] wrote files:")
                    for p in new_keys:
                        print(" -", p)
                last_code_files_keys = keys

            if node == "PM":
                print("[PM] PRD summary:", summarize_prd(payload.get("prd")))
            elif node == "Designer":
                design_spec = payload.get("design_spec") or {}
                theme_config = design_spec.get("theme_config") if isinstance(design_spec, dict) else None
                print("[Designer] theme_config:")
                print(json.dumps(theme_config, ensure_ascii=False, indent=2))
            elif node == "QA":
                reports = payload.get("test_reports") or []
                last = reports[-1] if reports and isinstance(reports[-1], dict) else {}
                exit_code = last.get("exit_code")
                print(f"[QA] exit_code={exit_code}")
                if last.get("error"):
                    print("[QA] suggestions:")
                    for s in last.get("suggestions") or []:
                        print(" -", s)
                else:
                    print("[QA] build succeeded")
        else:
            print("[payload]", payload)

    divider("FINAL STATE")
    final_state = graph.invoke(state)
    reports = final_state.get("test_reports") or []
    last = reports[-1] if reports and isinstance(reports[-1], dict) else {}
    ok = (last.get("exit_code") == 0) and (not last.get("error"))

    print("[Final] retry_count =", final_state.get("retry_count"))
    print("[Final] files_written =", sorted(set(written_paths)) if written_paths else list((final_state.get("code_files") or {}).keys()))
    print("[Final] qa_exit_code =", last.get("exit_code"))

    if ok:
        print("Final State: SUCCESS")
        return 0

    print("Final State: FAILED")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

