---
id: "0001"
title: "LLM Evaluation Framework: Trajectories vs. Outputs"
url: https://www.langchain.com/articles/llm-evaluation-framework
source: LangChain Blog
saved: 2026-05-21
tags: [eval, llm-testing, trajectory, output]
applied_in:
  - evals/skill-authoring.eval.md
---

## 핵심 인사이트

- **Output eval**: 최종 산출물만 검토 — 단순 RAG, 결정적 실행 경로에 충분
- **Trajectory eval**: 도구 선택·중간 추론·대화 턴 전체 경로 검토 — 멀티스텝 에이전트, 규제 산업(감사 추적 필요) 시 필수
- Output eval은 "맞는 답인데 잘못된 과정"을 놓친다 (예: 환불 처리됐지만 신원 확인 건너뜀)

## 적용한 내용

`eval_type: output | trajectory` 필드를 eval frontmatter에 추가.
현재 claw skill 검토는 Output eval로 충분 — 산출물(SKILL.md)이 정적이고 결정적이기 때문.
복잡한 멀티스텝 구현 작업에는 나중에 Trajectory eval 도입 예정.

## 원문 발췌

> "Trajectory evaluation scores the full execution path — tool selections, intermediate reasoning, and conversation turns."
