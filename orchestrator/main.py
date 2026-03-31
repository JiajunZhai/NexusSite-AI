from __future__ import annotations

import json
import os
import threading
import uuid
import urllib.request
import urllib.error
from typing import Any, Dict, Optional, List, Tuple

from fastapi import Body, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage

from tools.docker_tool import SandboxManager
from tools.log_bus import LogBus
from workflow.state_machine import graph, graph_from_designer, set_log_bus

app = FastAPI(title="NexusSite-AI Orchestrator", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log_bus = LogBus()
set_log_bus(log_bus)
sandbox = SandboxManager()
latest_runs: Dict[str, Dict[str, Any]] = {}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/models")
def list_models():
    """
    Return a model catalog grouped by provider (OpenRouter), plus OpenCode Zen options.
    """

    def _openrouter_headers() -> Dict[str, str]:
        api_key = os.getenv("OPENROUTER_API_KEY") or ""
        app_name = os.getenv("OPENROUTER_APP_NAME") or "NexusSite-AI"
        http_referer = os.getenv("OPENROUTER_HTTP_REFERER") or "http://localhost:3002"
        h = {
            "Content-Type": "application/json",
            "X-Title": app_name,
            "HTTP-Referer": http_referer,
        }
        if api_key:
            h["Authorization"] = f"Bearer {api_key}"
        return h

    def _fetch_openrouter_models() -> List[Dict[str, Any]]:
        """
        OpenRouter official models endpoint:
        GET https://openrouter.ai/api/v1/models
        """
        url = "https://openrouter.ai/api/v1/models"
        req = urllib.request.Request(url, headers=_openrouter_headers(), method="GET")
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
        data = raw.get("data")
        if isinstance(data, list):
            return data
        return []

    # Fallback curated list (used if OpenRouter call fails)
    curated = [
        ("qwen", "qwen/qwen3.6-plus-preview:free", "Qwen 3.6 Plus Preview (Free)"),
        ("google", "google/gemma-2-9b-it:free", "Gemma 2 9B IT (Free)"),
        (
            "meta-llama",
            "meta-llama/llama-3.1-8b-instruct:free",
            "Llama 3.1 8B Instruct (Free)",
        ),
        ("meta-llama", "meta-llama/llama-3.1-70b-instruct", "Llama 3.1 70B Instruct"),
        ("anthropic", "anthropic/claude-3.5-sonnet", "Claude 3.5 Sonnet"),
        ("openai", "openai/gpt-4o-mini", "GPT-4o mini"),
    ]

    provider_to_models: Dict[str, List[Dict[str, Any]]] = {}
    try:
        rows = _fetch_openrouter_models()
        for m in rows:
            mid = m.get("id")
            name = m.get("name") or mid
            if not isinstance(mid, str) or "/" not in mid:
                continue
            provider = mid.split("/", 1)[0]
            provider_to_models.setdefault(provider, []).append(
                {"id": mid, "label": str(name)}
            )
    except Exception:
        for provider, mid, label in curated:
            provider_to_models.setdefault(provider, []).append(
                {"id": mid, "label": label}
            )

    # sort providers/models
    providers = sorted(provider_to_models.keys())
    for p in providers:
        provider_to_models[p] = sorted(provider_to_models[p], key=lambda x: x["label"])

    def _zen_headers() -> Dict[str, str]:
        api_key = os.getenv("OPENCODE_ZEN_API_KEY") or ""
        h = {"Content-Type": "application/json"}
        if api_key:
            h["Authorization"] = f"Bearer {api_key}"
        return h

    def _fetch_zen_models() -> List[Dict[str, Any]]:
        url = "https://opencode.ai/zen/v1/models"
        req = urllib.request.Request(url, headers=_zen_headers(), method="GET")
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
        data = raw.get("data")
        if isinstance(data, list):
            return data
        # some APIs return a bare list
        if isinstance(raw, list):
            return raw
        return []

    zen_models: List[Dict[str, Any]] = []
    try:
        for m in _fetch_zen_models():
            mid = m.get("id") or m.get("model")  # tolerate variants
            name = m.get("name") or m.get("label") or mid
            if not isinstance(mid, str) or not mid.strip():
                continue
            # OpenCode config uses "opencode/<model-id>"
            full_id = mid if mid.startswith("opencode/") else f"opencode/{mid}"
            zen_models.append({"id": full_id, "label": str(name)})
        zen_models = sorted(zen_models, key=lambda x: x["label"])
    except Exception:
        # Minimal fallback list from docs
        zen_models = [
            {"id": "opencode/qwen3.6-plus-free", "label": "Qwen3.6 Plus Free"},
            {"id": "opencode/nemotron-3-super-free", "label": "Nemotron 3 Super Free"},
            {"id": "opencode/claude-sonnet-4-5", "label": "Claude Sonnet 4.5"},
        ]

    presets = {
        "free": {
            "pm": "qwen/qwen3.6-plus-preview:free",
            "designer": "qwen/qwen3.6-plus-preview:free",
            "coder": "qwen/qwen3.6-plus-preview:free",
            "qa": "qwen/qwen3.6-plus-preview:free",
        },
        "balanced": {
            "pm": "google/gemma-2-9b-it:free",
            "designer": "google/gemma-2-9b-it:free",
            "coder": "qwen/qwen3.6-plus-preview:free",
            "qa": "openai/gpt-4o-mini",
        },
        "strong": {
            "pm": "openai/gpt-4o-mini",
            "designer": "openai/gpt-4o-mini",
            "coder": "anthropic/claude-3.5-sonnet",
            "qa": "openai/gpt-4o-mini",
        },
    }
    recommended = {
        "pm": "qwen/qwen3.6-plus-preview:free",
        "designer": "google/gemma-2-9b-it:free",
        "coder": "anthropic/claude-3.5-sonnet",
        "qa": "openai/gpt-4o-mini",
    }

    # Build flat model list with metadata for frontend
    flat_models = []
    for p in providers:
        for m in provider_to_models.get(p, []):
            is_free = m["id"].endswith(":free") or "free" in m["id"].lower()
            flat_models.append(
                {
                    "id": m["id"],
                    "label": m["label"],
                    "provider": p,
                    "kind": "openrouter",
                    "is_free": is_free,
                }
            )
    for m in zen_models:
        is_free = m["id"].endswith(":free") or "free" in m["id"].lower()
        flat_models.append(
            {
                "id": m["id"],
                "label": m["label"],
                "provider": "opencode-zen",
                "kind": "opencode_zen",
                "is_free": is_free,
            }
        )

    return {
        "ok": True,
        "openrouter": {
            "providers": providers,
            "models_by_provider": provider_to_models,
        },
        "opencode_zen": {
            "providers": ["opencode-zen"],
            "models_by_provider": {"opencode-zen": zen_models},
        },
        "flat_models": flat_models,
        "presets": presets,
        "recommended": recommended,
    }


@app.get("/api/logs/sse")
async def logs_sse():
    async def gen():
        # SSE format: "data: <json>\n\n"
        async for evt in log_bus.subscribe():
            yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.websocket("/ws/logs")
async def logs_ws(ws: WebSocket):
    await ws.accept()
    try:
        async for evt in log_bus.subscribe():
            await ws.send_text(json.dumps(evt, ensure_ascii=False))
    except WebSocketDisconnect:
        return


@app.post("/api/run")
def run_chain(payload: Dict[str, Any] = Body(default_factory=dict)):
    """
    Run the LangGraph workflow once and publish per-node progress to log bus.

    Supports two modes:
    - mode="plan": Only run PM node, return PRD for user confirmation
    - mode="full": Run complete workflow (default, for backward compatibility)
    """
    prompt = (
        payload.get("prompt")
        or payload.get("message")
        or "Create a simple marketing website."
    )
    model_id: Optional[str] = payload.get("model_id")  # legacy
    model_map = payload.get("model_map")
    deep_think = bool(payload.get("deep_think") or False)
    mode = payload.get("mode", "full")  # "plan" or "full"

    # Normalize model_map
    normalized_map: Optional[Dict[str, str]] = None
    if isinstance(model_map, dict):
        normalized_map = {}
        for k, v in model_map.items():
            if not k:
                continue
            ks = str(k).strip().lower()
            if (
                ks in {"pm", "designer", "coder", "qa"}
                and isinstance(v, str)
                and v.strip()
            ):
                normalized_map[ks] = v.strip()
    elif isinstance(model_id, str) and model_id.strip():
        # Backwards-compatible: single model applies to all roles.
        mid = model_id.strip()
        normalized_map = {"pm": mid, "designer": mid, "coder": mid, "qa": mid}

    # Optional: deep-think model forcing if coder model not provided.
    if deep_think and (not normalized_map or not normalized_map.get("coder")):
        forced = (payload.get("deep_think_coder_model_id") or "").strip()
        if forced:
            normalized_map = dict(normalized_map or {})
            normalized_map["coder"] = forced

    state: Dict[str, Any] = {
        "messages": [HumanMessage(content=str(prompt))],
        "code_files": {},
        "test_reports": [],
        "retry_count": 0,
        "model_map": normalized_map,
        "deep_think": deep_think,
    }

    run_id = str(uuid.uuid4())

    def _run():
        # Select graph based on mode
        if mode == "plan":
            active_graph = graph  # Full graph, but we'll stop after PM
            log_bus.publish_event(
                node_name="System",
                kind="status",
                message=f"run_id={run_id} 开始分析需求（PM 阶段）",
                data={"run_id": run_id},
            )
        else:
            active_graph = graph
            log_bus.publish_event(
                node_name="System",
                kind="status",
                message=f"run_id={run_id} 开始执行工作流（PM → Designer → Coder → QA）",
                data={"run_id": run_id},
            )

        last_state: Dict[str, Any] = state
        try:
            for event in active_graph.stream(state):
                node = next(iter(event.keys()))
                if isinstance(event.get(node), dict):
                    last_state = event[node]
                    latest_runs[run_id] = last_state

                # For plan mode, stop after PM
                if mode == "plan" and node == "PM":
                    # Publish PRD event before breaking
                    prd = (
                        event[node].get("prd")
                        if isinstance(event[node], dict)
                        else None
                    )
                    if isinstance(prd, dict):
                        log_bus.publish_event(
                            node_name="PM",
                            kind="prd",
                            message=f"PRD 已生成：{prd.get('project_name')}",
                            data={
                                "project_name": prd.get("project_name"),
                                "pages": prd.get("pages"),
                                "features": prd.get("features"),
                                "user_flow": prd.get("user_flow"),
                            },
                        )
                    log_bus.publish_event(
                        node_name="System",
                        kind="plan_ready",
                        message="需求分析完成，等待确认",
                        data={
                            "run_id": run_id,
                            "prd": prd if isinstance(prd, dict) else None,
                        },
                    )
                    break

                if node == "PM":
                    log_bus.publish_event(
                        node_name="PM", kind="status", message="正在分析您的需求…"
                    )
                elif node == "Designer":
                    log_bus.publish_event(
                        node_name="Designer",
                        kind="status",
                        message="正在生成视觉规范（theme_config）…",
                    )
                elif node == "Coder":
                    log_bus.publish_event(
                        node_name="Coder",
                        kind="status",
                        message="正在生成代码并写入 Sandbox…",
                    )
                elif node == "QA":
                    log_bus.publish_event(
                        node_name="QA",
                        kind="status",
                        message="正在执行 npm run build 进行验收…",
                    )
                else:
                    log_bus.publish_event(
                        node_name=str(node), kind="status", message="运行中…"
                    )

                if node == "PM":
                    prd = (
                        event[node].get("prd")
                        if isinstance(event[node], dict)
                        else None
                    )
                    if isinstance(prd, dict):
                        log_bus.publish_event(
                            node_name="PM",
                            kind="prd",
                            message=f"PRD 已生成：{prd.get('project_name')}",
                            data={
                                "project_name": prd.get("project_name"),
                                "pages": prd.get("pages"),
                                "features": prd.get("features"),
                                "user_flow": prd.get("user_flow"),
                            },
                        )
                if node == "Designer":
                    ds = (
                        event[node].get("design_spec")
                        if isinstance(event[node], dict)
                        else None
                    )
                    if isinstance(ds, dict) and isinstance(
                        ds.get("theme_config"), dict
                    ):
                        tc = ds["theme_config"]
                        log_bus.publish_event(
                            node_name="Designer",
                            kind="theme_config",
                            message="theme_config 已生成",
                            data=tc,
                        )
                if node == "Coder":
                    cf = (
                        event[node].get("code_files")
                        if isinstance(event[node], dict)
                        else None
                    )
                    if isinstance(cf, dict) and cf:
                        files = sorted(list(cf.keys()))
                        log_bus.publish_event(
                            node_name="Coder",
                            kind="files_written",
                            message=f"已写入 {len(files)} 个文件",
                            data={"files": files},
                        )
                if node == "QA":
                    reports = (
                        event[node].get("test_reports")
                        if isinstance(event[node], dict)
                        else None
                    )
                    if (
                        reports
                        and isinstance(reports, list)
                        and isinstance(reports[-1], dict)
                    ):
                        last = reports[-1]
                        log_bus.publish_event(
                            node_name="QA",
                            kind="build_result",
                            message="Build 验收完成",
                            data={
                                "exit_code": last.get("exit_code"),
                                "error": last.get("error"),
                                "summary": last.get("summary"),
                                "suggestions": last.get("suggestions"),
                            },
                        )
        except Exception as e:
            log_bus.publish_event(
                node_name="System",
                kind="error",
                message=f"run_id={run_id} 运行异常: {e}",
                data={"run_id": run_id},
            )
        finally:
            latest_runs[run_id] = last_state
            if mode != "plan":
                log_bus.publish_event(
                    node_name="System",
                    kind="done",
                    message=f"run_id={run_id} 工作流完成",
                    data={"run_id": run_id},
                )

    threading.Thread(target=_run, daemon=True).start()
    return {"ok": True, "run_id": run_id}


@app.post("/api/continue")
def continue_chain(payload: Dict[str, Any] = Body(default_factory=dict)):
    """
    Continue workflow from PM output (Designer → Coder → QA).
    Called after user confirms the PRD.
    """
    run_id = payload.get("run_id")
    if not run_id or run_id not in latest_runs:
        raise HTTPException(status_code=400, detail="Invalid or missing run_id")

    # Get the state from the completed PM run
    state = dict(latest_runs[run_id])
    model_map = payload.get("model_map")
    deep_think = bool(payload.get("deep_think") or False)

    # Update state with any new model_map or settings
    if isinstance(model_map, dict):
        state["model_map"] = model_map
    if deep_think:
        state["deep_think"] = True

    # Start from Designer node
    continue_run_id = str(uuid.uuid4())

    def _run():
        log_bus.publish_event(
            node_name="System",
            kind="status",
            message=f"run_id={continue_run_id} 用户已确认需求，继续执行（Designer → Coder → QA）",
            data={"run_id": continue_run_id, "parent_run_id": run_id},
        )
        last_state: Dict[str, Any] = state
        try:
            for event in graph_from_designer.stream(state):
                node = next(iter(event.keys()))
                if isinstance(event.get(node), dict):
                    last_state = event[node]
                    latest_runs[continue_run_id] = last_state

                if node == "Designer":
                    log_bus.publish_event(
                        node_name="Designer",
                        kind="status",
                        message="正在生成视觉规范（theme_config）…",
                    )
                elif node == "Coder":
                    log_bus.publish_event(
                        node_name="Coder",
                        kind="status",
                        message="正在生成代码并写入 Sandbox…",
                    )
                elif node == "QA":
                    log_bus.publish_event(
                        node_name="QA",
                        kind="status",
                        message="正在执行 npm run build 进行验收…",
                    )
                else:
                    log_bus.publish_event(
                        node_name=str(node), kind="status", message="运行中…"
                    )

                if node == "Designer":
                    ds = (
                        event[node].get("design_spec")
                        if isinstance(event[node], dict)
                        else None
                    )
                    if isinstance(ds, dict) and isinstance(
                        ds.get("theme_config"), dict
                    ):
                        tc = ds["theme_config"]
                        log_bus.publish_event(
                            node_name="Designer",
                            kind="theme_config",
                            message="theme_config 已生成",
                            data=tc,
                        )
                if node == "Coder":
                    cf = (
                        event[node].get("code_files")
                        if isinstance(event[node], dict)
                        else None
                    )
                    if isinstance(cf, dict) and cf:
                        files = sorted(list(cf.keys()))
                        log_bus.publish_event(
                            node_name="Coder",
                            kind="files_written",
                            message=f"已写入 {len(files)} 个文件",
                            data={"files": files},
                        )
                if node == "QA":
                    reports = (
                        event[node].get("test_reports")
                        if isinstance(event[node], dict)
                        else None
                    )
                    if (
                        reports
                        and isinstance(reports, list)
                        and isinstance(reports[-1], dict)
                    ):
                        last = reports[-1]
                        log_bus.publish_event(
                            node_name="QA",
                            kind="build_result",
                            message="Build 验收完成",
                            data={
                                "exit_code": last.get("exit_code"),
                                "error": last.get("error"),
                                "summary": last.get("summary"),
                                "suggestions": last.get("suggestions"),
                            },
                        )
        except Exception as e:
            log_bus.publish_event(
                node_name="System",
                kind="error",
                message=f"run_id={continue_run_id} 运行异常: {e}",
                data={"run_id": continue_run_id},
            )
        finally:
            latest_runs[continue_run_id] = last_state
            log_bus.publish_event(
                node_name="System",
                kind="done",
                message=f"run_id={continue_run_id} 工作流完成",
                data={"run_id": continue_run_id},
            )

    threading.Thread(target=_run, daemon=True).start()
    return {"ok": True, "run_id": continue_run_id}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    return {"run_id": run_id, "state": latest_runs.get(run_id)}


@app.get("/api/export")
def export_workspace():
    """
    Stream a tar.gz of /workspace from the workspace container.
    """
    container = sandbox._container()  # reuse manager's resolution
    exec_id = sandbox.client.api.exec_create(
        container.id,
        ["sh", "-lc", "cd /workspace && tar -czf - ."],
        stdout=True,
        stderr=True,
        tty=False,
    )["Id"]

    stream = sandbox.client.api.exec_start(exec_id, stream=True, demux=False)

    headers = {"Content-Disposition": "attachment; filename=workspace.tar.gz"}
    return StreamingResponse(stream, media_type="application/gzip", headers=headers)


@app.get("/api/files")
def list_files():
    """
    Return a flat list of files under workspace/app (repo-relative paths).
    """
    try:
        files = sandbox.list_files(root="app")
        return {"ok": True, "root": "app", "files": sorted(files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/files/content")
def read_file(path: str):
    """
    Read a file under /workspace. Path must be repo-relative, e.g. app/page.tsx
    """
    path = (path or "").strip()
    if not path:
        raise HTTPException(status_code=400, detail="path is required")
    try:
        text = sandbox.read_file(path)
        return {"ok": True, "path": path, "content": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
