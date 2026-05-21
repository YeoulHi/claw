---
id: "0004"
title: run-ticket skill 초안
type: one-off
cluster: infra
status: backlog
eval: skill-authoring
created: 2026-05-21
---

## 목표

ticket id를 입력받아 task.json을 읽고 실행하는 claw skill을 만든다.
skill이 ticket의 `type`과 `steps`를 보고 스크립트 실행 vs LLM 실행을 자동 분기한다.

## 발현 맥락

advisor 논의(2026-05-21) → skill이 ticket을 읽어 실행하려면 ticket 포맷이 계약을 갖춰야 함.
0002(스키마), 0003(result) 확정 후 실행 레이어를 skill로 구현.

## skill 실행 계약

skill이 탐색하는 순서:
1. `tickets/NNNN-*.md` — type, eval, status 파악
2. `tickets/NNNN-*.task.json` — steps 또는 prompt 로드
3. eval 필드 있으면 `evals/{eval}.eval.md` 로드 → 판정 기준 주입

## 분기 로직

- steps[].type == "script" → run.ps1 / run.sh 실행
- steps[].type == "llm" → prompt를 Claude SDK로 실행
- steps 없고 prompt 있으면 → prompt 단독 실행 (하위 호환)

## 트리거 예시

- "0003 티켓 실행해줘"
- "run ticket 0003"
- "티켓 0003 돌려봐"

## 선행 조건

0002 (스키마 확정), 0003 (result 포맷 확정)

## 설계 메모

- skill은 claw/skills/run-ticket/SKILL.md 에 위치
- 실행 검증 전 SKILL.md 초안 금지 원칙 적용 → SDK 연동 먼저 PoC 후 작성
