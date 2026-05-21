---
id: skill-authoring
version: 2
eval_type: output
applies_to:
  - skill 신규 작성
  - skill 수정
---

## 체크리스트

각 항목은 PASS / FAIL / SKIP 중 하나로 판정한다.
실행 결과는 task.json의 `results` 배열에 기록한다.

- [ ] SKILL.md frontmatter에 `name`, `description`, `triggers` 모두 존재
- [ ] `triggers` 3개 이상, 실제 사용자 표현 반영
- [ ] 본문이 systemAppend 단독 주입 시 자립적으로 읽힘 (외부 파일 참조 없음)
- [ ] 스크립트/외부 라이브러리 포함 시 실행 검증 완료 여부 명시

## 리뷰 에이전트 지침

위 체크리스트를 순서대로 확인하라.
FAIL 항목은 구체적 수정 위치와 수정 예시를 포함해 리포트하라.
SKIP 사유는 명시적으로 기록하라.

## 판정 기준

- 모든 항목 PASS → APPROVED
- FAIL 1개 이상 → CHANGES_REQUESTED (항목별 이유 첨부)
- SKIP만 있을 경우 → CONDITIONAL_APPROVED

## 여정 (이 eval이 생긴 맥락)

**발현 계기:** CLAUDE.md에 "스크립트·외부 라이브러리가 포함된 skill은 실행 검증 전 SKILL.md 초안 작성 금지" 원칙이 추가된 사건. 검증 전 선작성으로 인한 이중 수정 경험이 기준화됨.

**기각된 기준들:**
- "triggers가 한국어/영어 혼용이어야 한다" → 지나치게 형식적, skill 내용에 따라 달라질 수 있어 기각
- "본문 길이 제한" → eval 기준이 아닌 리뷰어 판단 영역으로 분류

**참조:**
- `claw/CLAUDE.md` — "Skill 작성 검증 원칙" 섹션
