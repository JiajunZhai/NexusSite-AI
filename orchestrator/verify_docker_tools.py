from __future__ import annotations

from tools.docker_tool import SandboxManager


def main() -> int:
    print("== verify_docker_tools ==")

    # 1) init
    sm = SandboxManager()
    print(f"[init] workspace_container={sm.workspace_container}")

    # 2) write test file (into host ./workspace/... via container /workspace/...)
    rel_path = "src/app/hello-nexus/page.tsx"
    content = 'export default function Page() { return <h1>Hello NexusSite!</h1>; }'

    print(f"\n[write_file] {rel_path}")
    write_result = sm.write_file(rel_path, content)
    print(write_result)

    # 3) read & exec validation (note: inside workspace container we expose /app -> /workspace)
    print("\n[run_command] ls -R /app/src/app/hello-nexus")
    r1 = sm.run_command("ls -R /app/src/app/hello-nexus", on_output=None)
    print(f"exit_code={r1.exit_code}")
    print("stdout:")
    print(r1.stdout)
    print("stderr:")
    print(r1.stderr)

    print("\n[run_command] cat /app/src/app/hello-nexus/page.tsx")
    r2 = sm.run_command("cat /app/src/app/hello-nexus/page.tsx", on_output=None)
    print(f"exit_code={r2.exit_code}")
    print("stdout:")
    print(r2.stdout)
    print("stderr:")
    print(r2.stderr)

    # 4) permission validation
    print("\n[run_command] touch /app/src/app/hello-nexus/test.lock")
    r3 = sm.run_command("touch /app/src/app/hello-nexus/test.lock", on_output=None)
    print(f"exit_code={r3.exit_code}")
    print("stdout:")
    print(r3.stdout)
    print("stderr:")
    print(r3.stderr)

    # 5) optional cleanup
    print("\n[cleanup] rm -rf /app/src/app/hello-nexus")
    r4 = sm.run_command("rm -rf /app/src/app/hello-nexus", on_output=None)
    print(f"exit_code={r4.exit_code}")
    if r4.stdout:
        print("stdout:")
        print(r4.stdout)
    if r4.stderr:
        print("stderr:")
        print(r4.stderr)

    ok = r1.exit_code == 0 and r2.exit_code == 0 and content in (r2.stdout or "") and r3.exit_code == 0
    print(f"\n[result] {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

