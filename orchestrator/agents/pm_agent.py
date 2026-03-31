from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from agents.llm_client import LLMError, OpenRouterClient


PM_SYSTEM_PROMPT = """你是一位拥有 10 年经验的资深产品经理，专注于 Web 产品规划。你的任务是将用户的模糊需求转化为专业、可执行的网站产品需求文档（PRD）。

## 输出格式要求
- 必须使用中文输出
- 只输出合法 JSON，不要包含任何其他文字、markdown 标记或解释
- JSON 必须包含以下所有字段，不可省略

## 字段定义

### 基础信息
- project_name: 项目名称（简洁，2-6 个中文字）
- tagline: 一句话价值主张（15 字以内，有吸引力）
- target_audience: 目标用户群体（具体人群，非泛泛描述）

### 页面规划（pages 数组）
每个页面必须包含：
- path: 路由路径（必须以 "/" 开头）
- title: 页面标题（中文）
- purpose: 页面核心目的（一句话说明）
- sections: 页面包含的内容区块（数组，至少 3 个）

首页（"/"）必须存在，总页面数 3-6 个。

### 功能规划
- core_features: 核心功能数组（P0 优先级，MVP 必须实现）
  每个功能包含：name（功能名）、description（一句话描述）、priority（固定 "P0"）
- optional_features: 可选功能数组（P1 优先级，后续迭代）
  每个功能包含：name、description、priority（固定 "P1"）

核心功能至少 3 个，可选功能至少 1 个。

### 用户流程（user_flow 数组）
- 描述用户从访问到转化的完整路径
- 至少 4 个步骤，用中文描述
- 体现用户心理和行为变化

### 设计方向（design_direction 对象）
- style: 设计风格关键词（如"现代极简、专业、科技感"）
- color_palette: 配色方案建议（如"深色主题 + 蓝紫渐变强调色"）
- typography: 字体风格建议
- inspiration: 参考产品（2-3 个知名产品名）

### 技术栈建议（tech_stack_suggestion 对象）
- frontend: 前端技术栈
- backend: 后端技术栈
- hosting: 部署平台
- analytics: 数据分析工具

### SEO 关键词（seo_keywords 数组）
- 4-6 个中文关键词
- 体现产品核心价值和使用场景

### 竞品分析（competitors 数组）
- 至少 2 个竞品
- 每个包含：name（竞品名）、strength（优势）、weakness（劣势）

### 成功指标（success_metrics 数组）
- 3 个可量化的成功指标
- 包含具体数值目标

## 质量要求
1. 深入理解用户意图，不要停留在表面需求
2. 功能设计要有差异化，体现产品独特价值
3. 页面规划要符合转化漏斗逻辑
4. 设计方向要具体，可指导实际开发
5. 竞品分析要客观，找出市场空白
6. 所有内容必须与用户需求强相关，不要泛泛而谈

## 示例输出
{
  "project_name": "AI 智能笔记",
  "tagline": "让知识管理更高效",
  "target_audience": "大学生、知识工作者、自由职业者",
  "pages": [
    {
      "path": "/",
      "title": "首页",
      "purpose": "展示核心价值主张，引导用户注册",
      "sections": ["Hero 区域与价值主张", "核心功能展示", "用户评价与案例", "免费试用 CTA"]
    },
    {
      "path": "/features",
      "title": "功能介绍",
      "purpose": "详细展示产品能力，建立信任",
      "sections": ["AI 摘要功能演示", "多端同步说明", "标签与分类系统", "协作功能介绍"]
    },
    {
      "path": "/pricing",
      "title": "定价方案",
      "purpose": "转化付费用户",
      "sections": ["免费计划说明", "专业版功能对比", "团队版介绍", "常见问题 FAQ"]
    }
  ],
  "core_features": [
    {"name": "AI 智能摘要", "description": "自动提取长文核心要点，节省阅读时间", "priority": "P0"},
    {"name": "多端实时同步", "description": "Web/iOS/Android 数据实时一致", "priority": "P0"},
    {"name": "智能标签系统", "description": "AI 自动分类和标签推荐", "priority": "P0"}
  ],
  "optional_features": [
    {"name": "团队协作空间", "description": "多人实时编辑和评论笔记", "priority": "P1"}
  ],
  "user_flow": [
    "用户通过搜索引擎或社交媒体访问首页",
    "被价值主张和功能演示吸引，产生兴趣",
    "浏览功能页面，评估是否满足需求",
    "查看定价方案，选择免费计划注册",
    "开始使用核心功能，体验产品价值"
  ],
  "design_direction": {
    "style": "现代极简、专业、有科技感",
    "color_palette": "深色主题 + 蓝紫渐变强调色",
    "typography": "无衬线字体，层次分明，易读性强",
    "inspiration": "Linear, Notion, Vercel"
  },
  "tech_stack_suggestion": {
    "frontend": "Next.js 14 + React + Tailwind CSS",
    "backend": "Supabase (PostgreSQL + Auth + Storage)",
    "hosting": "Vercel",
    "analytics": "Plausible Analytics"
  },
  "seo_keywords": ["AI 笔记", "智能知识管理", "AI 摘要生成", "多端笔记同步", "智能标签分类"],
  "competitors": [
    {"name": "Notion", "strength": "生态完善、功能全面", "weakness": "学习曲线陡峭、性能较重"},
    {"name": "Obsidian", "strength": "本地优先、双向链接强大", "weakness": "协作功能弱、移动端体验一般"}
  ],
  "success_metrics": ["注册转化率 > 5%", "页面平均停留时间 > 2 分钟", "7 日留存率 > 30%"]
}
"""


def _safe_json_load(s: str) -> Dict[str, Any]:
    if s is None:
        raise json.JSONDecodeError("None input", "", 0)
    s = s.strip()
    if s.startswith("```"):
        # Remove markdown code block markers
        lines = s.split("\n")
        json_lines = []
        in_json = False
        for line in lines:
            if line.strip().startswith("```json") or line.strip() == "```":
                in_json = not in_json if line.strip().startswith("```") else True
                continue
            if in_json or (not line.strip().startswith("```")):
                json_lines.append(line)
        s = "\n".join(json_lines).strip()
        # Remove any remaining ``` markers
        s = s.replace("```", "").strip()
    return json.loads(s)


@dataclass
class PMAgent:
    llm: OpenRouterClient = field(default_factory=OpenRouterClient)

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        messages = state.get("messages") or []
        user_text = ""
        for m in reversed(messages):
            # Support both dict-based messages and langchain HumanMessage
            if isinstance(m, dict) and m.get("role") == "user":
                user_text = str(m.get("content") or "")
                break
            if hasattr(m, "content"):
                user_text = str(getattr(m, "content") or "")
                if user_text:
                    break
        if not user_text:
            user_text = str(
                state.get("user_request") or "Create a simple marketing website."
            )

        model_map = state.get("model_map") or {}
        model_id = model_map.get("pm") if isinstance(model_map, dict) else None
        deep_think = bool(state.get("deep_think") or False)
        max_tokens = 4000 if deep_think else 2000

        if self.llm.is_configured():
            try:
                resp = self.llm.chat(
                    system=PM_SYSTEM_PROMPT,
                    user=user_text,
                    temperature=0.3,
                    model=model_id,
                    max_tokens=max_tokens,
                )
                prd = _safe_json_load(resp.text) if resp.text else None
            except (LLMError, json.JSONDecodeError):
                prd = None
        else:
            # Offline fallback for deterministic flow
            prd = {
                "project_name": "NexusSite-AI Demo",
                "tagline": "AI 驱动的网站生成平台",
                "target_audience": "创业者、中小企业、个人开发者",
                "pages": [
                    {
                        "path": "/",
                        "title": "首页",
                        "purpose": "展示平台核心价值，引导用户开始使用",
                        "sections": ["Hero 区域", "工作流程展示", "用户案例", "CTA"],
                    },
                    {
                        "path": "/features",
                        "title": "功能介绍",
                        "purpose": "详细展示平台能力",
                        "sections": ["AI 规划", "智能设计", "自动编码", "质量保障"],
                    },
                    {
                        "path": "/pricing",
                        "title": "定价方案",
                        "purpose": "转化付费用户",
                        "sections": ["免费版", "专业版", "企业版", "FAQ"],
                    },
                ],
                "core_features": [
                    {
                        "name": "AI 需求分析",
                        "description": "自动理解用户需求并生成 PRD",
                        "priority": "P0",
                    },
                    {
                        "name": "智能视觉设计",
                        "description": "基于设计系统自动生成 UI",
                        "priority": "P0",
                    },
                    {
                        "name": "自动代码生成",
                        "description": "将设计转化为生产级代码",
                        "priority": "P0",
                    },
                ],
                "optional_features": [
                    {
                        "name": "多语言支持",
                        "description": "自动生成多语言版本网站",
                        "priority": "P1",
                    }
                ],
                "user_flow": [
                    "用户访问首页，了解平台能力",
                    "输入需求描述，开始生成流程",
                    "预览生成结果，确认或调整",
                    "导出代码或一键部署",
                ],
                "design_direction": {
                    "style": "现代科技、专业、简洁",
                    "color_palette": "深色主题 + 蓝紫渐变",
                    "typography": "无衬线字体，清晰层次",
                    "inspiration": "Vercel, Linear, Stripe",
                },
                "tech_stack_suggestion": {
                    "frontend": "Next.js 14 + Tailwind CSS",
                    "backend": "FastAPI + LangGraph",
                    "hosting": "Vercel",
                    "analytics": "Plausible",
                },
                "seo_keywords": ["AI 建站", "智能网站生成", "AI 设计", "自动编码"],
                "competitors": [
                    {
                        "name": "Framer AI",
                        "strength": "设计能力强",
                        "weakness": "代码质量一般",
                    },
                    {
                        "name": "Wix ADI",
                        "strength": "用户基数大",
                        "weakness": "模板化严重",
                    },
                ],
                "success_metrics": [
                    "生成成功率 > 80%",
                    "用户满意度 > 4/5",
                    "导出转化率 > 30%",
                ],
            }

        if not prd:
            prd = {
                "project_name": "NexusSite-AI Demo",
                "tagline": "AI 驱动的网站生成平台",
                "target_audience": "创业者、中小企业、个人开发者",
                "pages": [
                    {
                        "path": "/",
                        "title": "首页",
                        "purpose": "展示平台核心价值，引导用户开始使用",
                        "sections": ["Hero 区域", "工作流程展示", "用户案例", "CTA"],
                    },
                    {
                        "path": "/features",
                        "title": "功能介绍",
                        "purpose": "详细展示平台能力",
                        "sections": ["AI 规划", "智能设计", "自动编码", "质量保障"],
                    },
                    {
                        "path": "/pricing",
                        "title": "定价方案",
                        "purpose": "转化付费用户",
                        "sections": ["免费版", "专业版", "企业版", "FAQ"],
                    },
                ],
                "core_features": [
                    {
                        "name": "AI 需求分析",
                        "description": "自动理解用户需求并生成 PRD",
                        "priority": "P0",
                    },
                    {
                        "name": "智能视觉设计",
                        "description": "基于设计系统自动生成 UI",
                        "priority": "P0",
                    },
                    {
                        "name": "自动代码生成",
                        "description": "将设计转化为生产级代码",
                        "priority": "P0",
                    },
                ],
                "optional_features": [
                    {
                        "name": "多语言支持",
                        "description": "自动生成多语言版本网站",
                        "priority": "P1",
                    }
                ],
                "user_flow": [
                    "用户访问首页，了解平台能力",
                    "输入需求描述，开始生成流程",
                    "预览生成结果，确认或调整",
                    "导出代码或一键部署",
                ],
                "design_direction": {
                    "style": "现代科技、专业、简洁",
                    "color_palette": "深色主题 + 蓝紫渐变",
                    "typography": "无衬线字体，清晰层次",
                    "inspiration": "Vercel, Linear, Stripe",
                },
                "tech_stack_suggestion": {
                    "frontend": "Next.js 14 + Tailwind CSS",
                    "backend": "FastAPI + LangGraph",
                    "hosting": "Vercel",
                    "analytics": "Plausible",
                },
                "seo_keywords": ["AI 建站", "智能网站生成", "AI 设计", "自动编码"],
                "competitors": [
                    {
                        "name": "Framer AI",
                        "strength": "设计能力强",
                        "weakness": "代码质量一般",
                    },
                    {
                        "name": "Wix ADI",
                        "strength": "用户基数大",
                        "weakness": "模板化严重",
                    },
                ],
                "success_metrics": [
                    "生成成功率 > 80%",
                    "用户满意度 > 4/5",
                    "导出转化率 > 30%",
                ],
            }

        state["prd"] = prd
        return state
