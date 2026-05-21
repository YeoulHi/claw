---
id: "0001"
title: eval/review 인프라 구축
status: completed
eval: ~
created: 2026-05-21
---

## 목표

재사용 가능한 검토 에이전트와 eval 기준 누적 구조를 만든다.

## 발현 맥락

2026-05-21 자동 분석 리포트에서 "병렬 검토를 매번 직접 지시해야 한다"는 반복 패턴 감지.
→ 검토 에이전트를 별도로 만들고, 검증 기준(evals)을 누적하는 구조 아이디어로 발전.

advisor와 1턴 논의 → 핵심 결론:
- evals는 ticket에 종속되지 않는 "유형 기준 라이브러리" (재사용 단위)
- tasks는 별도 폴더 없이 tickets/ 안에 병치 (agent 탐색 편의)
- 여정 섹션에는 반드시 "하지 않기로 한 것"과 "실패 이유"를 포함

## 구조 (확정)

```
claw/
├── skills/       (기존 유지)
├── src/          (기존 유지)
├── tickets/      ← ticket(.md) + task(.task.json) 병치
└── evals/        ← 유형별 재사용 기준 라이브러리
```

관계: `ticket → eval 참조 (by applies_to) / ticket → task 포함`

## 설계 선택 (Decision Log)

- [2026-05-21] `tasks/` 별도 폴더 기각 → tickets/ 내 병치 결정.
  이유: 같은 prefix 파일이 두 폴더에 흩어지면 agent가 context 재조립 필요
- [2026-05-21] evals를 ticket 종속으로 두는 방안 기각.
  이유: ticket마다 eval을 새로 쓰면 기준 누적 불가, 재사용 불가
- [2026-05-21] eval에 "리뷰 에이전트 지침" 섹션 추가.
  이유: eval 파일 하나만 전달해도 review agent가 즉시 실행 가능하도록

## 산출물

- `evals/skill-authoring.eval.md` — 첫 번째 eval (claw skill 검토 기준)
- `tickets/` + `evals/` 폴더 구조 확립
