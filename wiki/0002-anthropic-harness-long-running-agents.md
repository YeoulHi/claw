---
id: "0002"
title: "Effective Harnesses for Long-Running Agents"
url: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
source: Anthropic Engineering Blog
saved: 2026-05-21
tags: [agent, harness, eval, task-tracking, long-running]
applied_in:
  - tickets/0001-eval-review-infra.task.json
---

## 핵심 인사이트

- **Feature list JSON**: 체크리스트 항목에 `"passes": false` 필드로 실행 결과를 파일에 명시적 기록
- **두 단계 에이전트**: Initializer(최초 1회 환경 세팅) → Coding Agent(이후 세션 반복) 분리
- **황금 원칙**: 테스트/기준을 삭제하거나 수정하는 것은 허용 불가 — 기준은 누적만 된다
- 진행 상태를 git commit + progress 파일 두 곳에 동시 기록 (단일 실패 지점 방지)

## 적용한 내용

`task.json`에 `results[]` 배열 추가 — review agent가 각 체크리스트 항목의 pass/fail을 실행 후 기록하는 용도.

## 원문 발췌

> "It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality."
