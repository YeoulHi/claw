---
id: "0005"
title: eval 라이브러리 2차 확장
type: one-off
cluster: infra
status: backlog
eval: ~
created: 2026-05-21
---

## 목표

현재 `skill-authoring` 1개인 eval 라이브러리에 범용 평가 기준 2개를 추가한다.

## 발현 맥락

advisor 논의(2026-05-21) → 0003(result 포맷 확정) 후 다양한 ticket 유형에 적용할
eval 기준이 필요함. ticket-review와 task-result를 우선 추가.

## 추가 예정 eval

### ticket-review.eval.md
- 목적: ticket.md 품질 검토 (신규 ticket 작성 후 검토 시 사용)
- 체크 항목 예시:
  - [ ] id, title, type, cluster, status, created 필드 모두 존재
  - [ ] 목표 섹션이 1~3문장으로 명확함
  - [ ] 선행 조건 명시 (없으면 "없음" 명시)
  - [ ] task.json 병치 파일 존재 여부

### task-result.eval.md
- 목적: task.json 실행 결과 품질 검토 (배치/스크립트 실행 후 eval)
- 체크 항목 예시:
  - [ ] 모든 steps 실행 완료
  - [ ] 실패 step이 있으면 원인 기록됨
  - [ ] result.yaml 생성됨

## 작업 범위

1. `evals/ticket-review.eval.md` 작성
2. `evals/task-result.eval.md` 작성

## 선행 조건

0003 완료 (result.yaml 포맷 확정 후 기준 작성)
