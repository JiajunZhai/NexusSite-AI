from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, StateGraph

from agents.coder_agent import CoderAgent
from agents.designer_agent import DesignerAgent
from agents.pm_agent import PMAgent
from agents.qa_agent import QAAgent
from agents.reflector_agent import ReflectorAgent


class AgentState(TypedDict, total=False):
    """
    Shared state passed between agents in the LangGraph workflow.
    """

    messages: List[Dict[str, Any]]
    prd: Optional[Dict[str, Any]]
    design_spec: Optional[Any]
    code_files: Dict[str, str]
    test_reports: List[Dict[str, Any]]
    retry_count: int
    model_map: Optional[Dict[str, str]]
    deep_think: bool
    reflector_notes: Optional[str]


def pm_node(state: AgentState) -> AgentState:
    print("[node] PM")
    return PMAgent().run(state)


def designer_node(state: AgentState) -> AgentState:
    print("[node] Designer")
    return DesignerAgent().run(state)


def coder_node(state: AgentState) -> AgentState:
    print("[node] Coder")
    return CoderAgent().run(state)


def reflector_node(state: AgentState) -> AgentState:
    print("[node] Reflector")
    return ReflectorAgent().run(state)


def qa_node(state: AgentState) -> AgentState:
    print("[node] QA")
    return QAAgent().run(state)


def _qa_should_retry(state: AgentState) -> str:
    """
    Conditional routing after QA.

    - If test_reports has errors AND retry_count < 3 -> back to Coder
    - Else -> END
    """
    retry_count = int(state.get("retry_count", 0) or 0)
    test_reports = state.get("test_reports", []) or []

    # Only consider the latest QA result to avoid "sticky" historical errors
    # causing infinite retry loops after a successful build.
    last_error = None
    if test_reports and isinstance(test_reports[-1], dict):
        last_error = test_reports[-1].get("error")

    if bool(last_error) and retry_count < 3:
        return "Coder"
    return END


def build_graph():
    """
    Build and compile the LangGraph state machine:
    PM -> Designer -> (Reflector?) -> Coder -> QA -> (Coder | END)
    """
    g = StateGraph(AgentState)

    g.add_node("PM", pm_node)
    g.add_node("Designer", designer_node)
    g.add_node("Reflector", reflector_node)
    g.add_node("Coder", coder_node)
    g.add_node("QA", qa_node)

    g.set_entry_point("PM")
    g.add_edge("PM", "Designer")
    def _after_designer(state: AgentState) -> str:
        return "Reflector" if bool(state.get("deep_think") or False) else "Coder"

    g.add_conditional_edges("Designer", _after_designer, {"Reflector": "Reflector", "Coder": "Coder"})
    g.add_edge("Reflector", "Coder")
    g.add_edge("Coder", "QA")

    g.add_conditional_edges("QA", _qa_should_retry, {"Coder": "Coder", END: END})

    return g.compile()


# Export a compiled graph instance for simple imports/testing.
graph = build_graph()

