from __future__ import annotations

from pprint import pprint

from workflow.state_machine import graph


def run_case(title: str, initial_state: dict):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)

    print("\n[initial_state]")
    pprint(initial_state)

    print("\n[stream] node-by-node outputs")
    last_state = None
    step = 0
    for event in graph.stream(initial_state):
        step += 1
        # event shape: {node_name: state_delta_or_state}
        node_name = next(iter(event.keys()))
        payload = event[node_name]
        print(f"  step={step:02d} node={node_name}")
        pprint(payload)
        last_state = payload

    print("\n[invoke] final state")
    final_state = graph.invoke(initial_state)
    pprint(final_state)
    return final_state


def main():
    # 1) Happy path: no errors -> PM -> Designer -> Coder -> QA -> END
    run_case(
        "CASE 1: Happy path (PM -> Designer -> Coder -> QA -> END)",
        {
            "messages": [{"role": "user", "content": "dummy request"}],
            "prd": "mock prd",
            "design_spec": None,
            "code_files": {},
            "test_reports": [],
            "retry_count": 0,
        },
    )

    # 2) Retry path: QA sees an error -> jump back to Coder (until retry_count reaches 3)
    run_case(
        "CASE 2: Retry path (QA error -> loop back to Coder while retry_count < 3)",
        {
            "messages": [{"role": "user", "content": "dummy request"}],
            "prd": "mock prd",
            "design_spec": None,
            "code_files": {},
            "test_reports": [{"error": "build failed: mock error"}],
            "retry_count": 0,
        },
    )

    # 3) End at retry limit: already at 3 -> should NOT loop again
    run_case(
        "CASE 3: Retry limit reached (retry_count=3 -> END even if error exists)",
        {
            "messages": [{"role": "user", "content": "dummy request"}],
            "prd": "mock prd",
            "design_spec": None,
            "code_files": {},
            "test_reports": [{"error": "build failed: mock error"}],
            "retry_count": 3,
        },
    )


if __name__ == "__main__":
    main()

