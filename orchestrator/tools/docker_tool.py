from __future__ import annotations

import base64
import os
import posixpath
import time
from dataclasses import dataclass
from typing import Callable, Iterable, Optional

import docker
from docker.models.containers import Container


class SandboxError(RuntimeError):
    pass


@dataclass(frozen=True)
class CommandResult:
    cmd: str
    exit_code: int
    stdout: str
    stderr: str

    @property
    def combined(self) -> str:
        if self.stderr:
            return f"{self.stdout}{'' if self.stdout.endswith(os.linesep) or not self.stdout else os.linesep}{self.stderr}"
        return self.stdout


class SandboxManager:
    """
    Manage the Workspace sandbox container via docker-py.

    Notes:
    - `write_file()` writes *inside the workspace container* under `/workspace/...`
      (which is bind-mounted to `./workspace` on the host via docker-compose).
    - `run_command()` executes commands inside the workspace container and streams output.
    - `get_preview_snapshot()` optionally uses Playwright (if installed) to screenshot
      the live preview page and returns Base64 PNG.
    """

    def __init__(
        self,
        *,
        workspace_container: str = "nexussite-ai-workspace-1",
        workspace_root: str = "/workspace",
        preview_url: str = "http://workspace:3000",
    ) -> None:
        self.client = docker.from_env()
        self.workspace_container = workspace_container
        self.workspace_root = workspace_root.rstrip("/") or "/workspace"
        self.preview_url = preview_url

    def _container(self) -> Container:
        try:
            return self.client.containers.get(self.workspace_container)
        except Exception as e:  # pragma: no cover
            raise SandboxError(f"Workspace container not found: {self.workspace_container}") from e

    def _to_container_path(self, path: str) -> str:
        """
        Normalize a repo-relative path to an absolute container path under /workspace.
        """
        if not path:
            raise ValueError("path is required")

        p = path.replace("\\", "/").lstrip("/")
        # Prevent escaping the workspace root.
        if p.startswith("../") or "/../" in p:
            raise ValueError("path must not escape workspace root")

        return posixpath.join(self.workspace_root, p)

    def write_file(self, path: str, content: str) -> dict:
        """
        Write file content to workspace, creating parent dirs if needed.

        Conflict handling:
        - If target exists and content differs, we create a backup:
          `<filename>.bak.<epoch_ms>` then atomically replace the target.
        - If content is identical, no-op.
        """
        container = self._container()
        target = self._to_container_path(path)
        parent = posixpath.dirname(target)
        filename = posixpath.basename(target)

        epoch_ms = int(time.time() * 1000)
        tmp_path = posixpath.join(parent, f".{filename}.tmp.{epoch_ms}")
        bak_path = posixpath.join(parent, f"{filename}.bak.{epoch_ms}")

        b64 = base64.b64encode(content.encode("utf-8")).decode("ascii")
        node_script = f"""
const fs = require("fs");
const path = require("path");

const target = {self._js_quote(target)};
const parent = {self._js_quote(parent)};
const tmpPath = {self._js_quote(tmp_path)};
const bakPath = {self._js_quote(bak_path)};
const data = Buffer.from({self._js_quote(b64)}, "base64");

fs.mkdirSync(parent, {{ recursive: true }});

if (fs.existsSync(target)) {{
  try {{
    const existing = fs.readFileSync(target);
    if (Buffer.compare(existing, data) === 0) {{
      console.log("__NOOP__");
      process.exit(0);
    }}
  }} catch (e) {{
    // ignore read errors; we'll attempt backup + overwrite
  }}

  try {{
    fs.copyFileSync(target, bakPath);
    console.log("__BACKUP__:" + bakPath);
  }} catch (e) {{
    console.log("__BACKUP_FAILED__:" + String(e && e.message ? e.message : e));
  }}
}}

fs.writeFileSync(tmpPath, data);
fs.renameSync(tmpPath, target);
console.log("__WROTE__:" + target);
"""
        exit_code, stdout, stderr = self._exec_sh(container, self._node_heredoc(node_script))
        if exit_code != 0:
            raise SandboxError(f"write_file failed: {stderr or stdout}")

        result: dict = {"path": path, "container_path": target, "status": "written"}
        for line in (stdout or "").splitlines():
            if line.startswith("__NOOP__"):
                result["status"] = "noop"
            elif line.startswith("__BACKUP__:"):
                result["backup_path"] = line.split(":", 1)[1]
            elif line.startswith("__WROTE__:"):
                result["written_path"] = line.split(":", 1)[1]
        return result

    def run_command(
        self,
        cmd: str,
        *,
        on_output: Optional[Callable[[str], None]] = print,
        workdir: str = "/workspace",
    ) -> CommandResult:
        """
        Run a shell command inside the workspace container.

        - Streams stdout/stderr in real-time via `on_output` (default: print).
        - Returns a CommandResult with exit code and captured output.
        """
        if not cmd:
            raise ValueError("cmd is required")

        container = self._container()
        # Keep this POSIX-sh compatible (dash), avoid bash-only options like pipefail.
        sh = f"set -eu; cd {self._sh_quote(workdir)}; {cmd}"
        exec_id = self.client.api.exec_create(
            container.id,
            ["sh", "-lc", sh],
            stdout=True,
            stderr=True,
            tty=False,
        )["Id"]

        stdout_chunks: list[str] = []
        stderr_chunks: list[str] = []

        for out in self.client.api.exec_start(exec_id, stream=True, demux=True):
            if not out:
                continue
            out_stdout, out_stderr = out
            if out_stdout:
                s = out_stdout.decode("utf-8", errors="replace")
                stdout_chunks.append(s)
                if on_output:
                    on_output(s)
            if out_stderr:
                s = out_stderr.decode("utf-8", errors="replace")
                stderr_chunks.append(s)
                if on_output:
                    on_output(s)

        info = self.client.api.exec_inspect(exec_id)
        exit_code = int(info.get("ExitCode", 1))
        return CommandResult(
            cmd=cmd,
            exit_code=exit_code,
            stdout="".join(stdout_chunks),
            stderr="".join(stderr_chunks),
        )

    def list_files(self, *, root: str = "app") -> list[str]:
        """
        List files under /workspace/<root> (recursive), returning repo-relative paths.
        """
        p = root.replace("\\", "/").strip("/")
        if not p:
            p = "app"
        if p.startswith("../") or "/../" in p:
            raise ValueError("root must not escape workspace root")

        container = self._container()
        target = posixpath.join(self.workspace_root, p)
        js = f"""
const fs = require("fs");
const path = require("path");

const base = {self._js_quote(target)};
const baseRel = {self._js_quote(p)};

function walk(dir, relPrefix) {{
  let out = [];
  let entries = [];
  try {{
    entries = fs.readdirSync(dir, {{ withFileTypes: true }});
  }} catch (e) {{
    return out;
  }}
  for (const ent of entries) {{
    const abs = path.join(dir, ent.name);
    const rel = relPrefix ? (relPrefix + "/" + ent.name) : ent.name;
    if (ent.isDirectory()) {{
      out = out.concat(walk(abs, rel));
    }} else if (ent.isFile()) {{
      out.push(baseRel + "/" + rel);
    }}
  }}
  return out;
}}

const files = walk(base, "");
console.log(JSON.stringify(files));
"""
        exit_code, stdout, stderr = self._exec_sh(container, self._node_heredoc(js))
        if exit_code != 0:
            raise SandboxError(f"list_files failed: {stderr or stdout}")
        try:
            return __import__("json").loads((stdout or "").strip() or "[]")
        except Exception as e:
            raise SandboxError(f"list_files parse failed: {e}") from e

    def read_file(self, path: str) -> str:
        """
        Read a file under /workspace and return utf-8 text.
        """
        container = self._container()
        target = self._to_container_path(path)
        js = f"""
const fs = require("fs");
const p = {self._js_quote(target)};
try {{
  const buf = fs.readFileSync(p);
  process.stdout.write(buf.toString("utf8"));
}} catch (e) {{
  console.error(String(e && e.message ? e.message : e));
  process.exit(2);
}}
"""
        exit_code, stdout, stderr = self._exec_sh(container, self._node_heredoc(js))
        if exit_code != 0:
            raise SandboxError(f"read_file failed: {stderr or stdout}")
        return stdout or ""

    def get_preview_snapshot(self, *, url: Optional[str] = None, width: int = 1440, height: int = 900) -> str:
        """
        Take a screenshot of the preview page and return Base64-encoded PNG bytes.

        Requires Playwright to be installed in the Orchestrator environment.
        """
        target_url = url or self.preview_url
        try:
            from playwright.sync_api import sync_playwright  # type: ignore
        except Exception as e:  # pragma: no cover
            raise SandboxError(
                "Playwright is not installed/configured in the Orchestrator container. "
                "Install Playwright and browsers to enable get_preview_snapshot()."
            ) from e

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(target_url, wait_until="networkidle")
            png_bytes = page.screenshot(full_page=True)
            browser.close()

        return base64.b64encode(png_bytes).decode("ascii")

    @staticmethod
    def _sh_quote(s: str) -> str:
        # POSIX shell single-quote escaping
        return "'" + s.replace("'", "'\"'\"'") + "'"

    @staticmethod
    def _py_quote(s: str) -> str:
        # Simple repr-style quoting for embedding literals in python heredoc
        return repr(s)

    def _exec_sh(self, container: Container, sh_script: str) -> tuple[int, str, str]:
        """
        Execute a multi-line shell script inside the container.
        Returns (exit_code, stdout, stderr).
        """
        exec_id = self.client.api.exec_create(
            container.id,
            ["sh", "-lc", sh_script],
            stdout=True,
            stderr=True,
            tty=False,
        )["Id"]

        stdout_chunks: list[str] = []
        stderr_chunks: list[str] = []

        for out in self.client.api.exec_start(exec_id, stream=True, demux=True):
            if not out:
                continue
            out_stdout, out_stderr = out
            if out_stdout:
                stdout_chunks.append(out_stdout.decode("utf-8", errors="replace"))
            if out_stderr:
                stderr_chunks.append(out_stderr.decode("utf-8", errors="replace"))

        info = self.client.api.exec_inspect(exec_id)
        exit_code = int(info.get("ExitCode", 1))
        return exit_code, "".join(stdout_chunks), "".join(stderr_chunks)

    @staticmethod
    def _node_heredoc(js: str) -> str:
        # Run node in a way that's safe for /bin/sh (dash).
        return "node - <<'NODE'\n" + js.strip() + "\nNODE\n"

    @staticmethod
    def _js_quote(s: str) -> str:
        # Quote a JS string literal safely.
        return repr(s)

