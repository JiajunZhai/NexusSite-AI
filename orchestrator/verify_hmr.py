from __future__ import annotations

from tools.docker_tool import SandboxManager


HMR_PAGE_TSX = """export default function TestPage() {
  return (
    <main className="h-screen w-screen flex items-center justify-center bg-purple-600">
      <h1 className="text-6xl font-bold text-white animate-bounce">
        HMR IS WORKING! 🚀
      </h1>
    </main>
  );
}
"""


def main() -> int:
    print("== verify_hmr ==")
    sm = SandboxManager()
    print(f"[init] workspace_container={sm.workspace_container}")

    # Next.js in this repo is initialized with --no-src-dir, so `app/` is the
    # active App Router directory. We also write to `src/app/` to match the
    # requested path and keep both in sync for future src-dir migrations.
    targets = [
        "app/page.tsx",
        "src/app/page.tsx",
    ]

    for rel_path in targets:
        print(f"\n[write_file] {rel_path}")
        res = sm.write_file(rel_path, HMR_PAGE_TSX)
        print(res)

    print("\n[done] Now check http://localhost:3000 for the purple HMR page.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

