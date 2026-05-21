---
id: "0002"
title: ticket 스키마 표준화
type: one-off
cluster: infra
status: backlog
eval: ~
created: 2026-05-21
---

## 목표

ticket.md frontmatter에 `type`과 `cluster` 필드를 추가해 범용 작업 인프라로 확장한다.

## 발현 맥락

0001에서 eval/ticket 구조를 확립했지만 ticket 스키마가 마이그레이션 전용으로 설계됨.
advisor 논의(2026-05-21) → `type` 필드로 마이그레이션/리팩토링/배치 등 구분,
`cluster` 필드로 도메인/프로젝트 분류가 필요함을 확인.

## 작업 범위

1. ticket.md 표준 스키마 확정 (type, cluster 포함)
2. `0001-eval-review-infra.md`에 신규 필드 backfill
3. task.json 표준 포맷 확정 — steps 배열 도입 (기존 prompt 단독 방식과 하위 호환)

## 확정 스키마

```yaml
---
id: "NNNN"
title: "작업 제목"
type: migration | refactor | batch | data-clean | one-off
cluster: "관련 도메인 또는 infra"
status: backlog | active | completed | cancelled
eval: ~              # 적용할 eval id 또는 ~
created: YYYY-MM-DD
---
```

## task.json steps 포맷 (선택적)

```json
{
  "id": "NNNN-slug",
  "ticket": "NNNN",
  "eval": null,
  "steps": [
    { "order": 1, "type": "script", "run": "run.ps1" },
    { "order": 2, "type": "llm", "prompt": "결과 검토 후 판정" }
  ]
}
```

steps 없으면 기존 prompt 필드 단독 실행 (하위 호환 유지).

## 선행 조건

없음
