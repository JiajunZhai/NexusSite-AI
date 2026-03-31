from __future__ import annotations

import re
import time

from tools.docker_tool import SandboxError, SandboxManager


def banner(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def main() -> int:
    sm = SandboxManager()
    print(f"== verify_docker_tools_deep ==\n[init] workspace_container={sm.workspace_container}")

    # 1) Conflict + backup
    banner("1) Conflict + backup verification")
    rel_path = "src/app/test-logic/page.tsx"
    v1 = "export default function Page() { return <h1>Version 1</h1>; }\n"
    v2 = "export default function Page() { return <h1>Version 2</h1>; }\n"

    r1 = sm.write_file(rel_path, v1)
    print("[write v1]", r1)
    assert_true(r1["status"] in ("written", "noop"), "write v1 should succeed")

    r2 = sm.write_file(rel_path, v2)
    print("[write v2]", r2)
    assert_true(r2["status"] == "written", "write v2 should overwrite (written)")
    assert_true("backup_path" in r2, "write v2 should create backup_path when file existed")
    assert_true(re.search(r"\.bak\.\d+$", r2["backup_path"]) is not None, "backup_path should end with .bak.<timestamp>")

    # verify on disk inside container
    dir_path = "/workspace/src/app/test-logic"
    cat_path = "/workspace/src/app/test-logic/page.tsx"
    r_ls = sm.run_command(f"ls -la {dir_path}", on_output=None)
    print("\n[ls -la]", dir_path)
    print(r_ls.stdout)
    assert_true(r_ls.exit_code == 0, "ls should succeed")
    assert_true(".bak." in r_ls.stdout, "directory listing should include a .bak.* file")

    r_cat = sm.run_command(f"cat {cat_path}", on_output=None)
    print("\n[cat]", cat_path)
    print(r_cat.stdout)
    assert_true(r_cat.exit_code == 0, "cat should succeed")
    assert_true("Version 2" in r_cat.stdout, "page.tsx should contain Version 2")

    # 2) Streaming output
    banner("2) Streaming output verification")
    timeline: list[tuple[float, str]] = []
    t0 = time.monotonic()

    def on_out(chunk: str) -> None:
        now = time.monotonic() - t0
        for line in chunk.splitlines(True):
            timeline.append((now, line))
            print(f"[t+{now:0.2f}s] {line}", end="", flush=True)

    cmd = "sh -c \"echo 'Starting...'; sleep 2; echo 'Middle...'; sleep 2; echo 'Finished!'\""
    res = sm.run_command(cmd, on_output=on_out)
    print(f"\n[exit_code]={res.exit_code}")
    assert_true(res.exit_code == 0, "streaming command should succeed")

    # Heuristic: we should have observed output over time (not all at ~0s).
    # We expect at least one line after ~1.5s and one after ~3.5s.
    times = [t for t, _ in timeline if _.strip()]
    assert_true(any(t >= 1.5 for t in times), "should observe output after ~2s (Middle...)")
    assert_true(any(t >= 3.5 for t in times), "should observe output after ~4s (Finished!)")

    # 3) HMR loop (manual refresh requested)
    banner("3) HMR write (manual refresh in browser)")
    hmr_content = (
        "export default function Page() { return (<main className='bg-red-500 h-screen w-screen flex items-center justify-center'>"
        "<h1 className='text-5xl font-bold text-white'>HMR Test</h1></main>); }\n"
    )
    # This repo's Next.js app was initialized with --no-src-dir, so `app/` is the active
    # App Router directory. We write both to ensure the browser-visible route updates.
    for hmr_path in ("app/page.tsx", "src/app/page.tsx"):
        r_hmr = sm.write_file(hmr_path, hmr_content)
        print(f"[write HMR] {hmr_path}", r_hmr)
    print("[action] 请你现在手动刷新 http://localhost:3000 ，观察页面是否变为红色背景 HMR Test。")

    # 4) Path escape
    banner("4) Path escape prevention")
    try:
        sm.write_file("../outside.txt", "evil")
        raise AssertionError("path escape should have been blocked, but write_file succeeded")
    except (SandboxError, ValueError) as e:
        print("[expected] blocked:", type(e).__name__, str(e))

    # cleanup
    banner("Cleanup")
    sm.run_command("rm -rf /workspace/src/app/test-logic", on_output=None)
    print("[cleanup] removed /workspace/src/app/test-logic")

    print("\n[result] PASS (except HMR requires manual browser confirmation)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

