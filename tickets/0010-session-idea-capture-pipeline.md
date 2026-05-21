---
id: "0010"
title: "세션 아이디어 캡처 → 컴파운드 개선 파이프라인"
type: one-off
cluster: session-wrap
status: open
eval: ~
created: 2026-05-21
---

## 문제

매 대화에서 개선 아이디어가 나오지만 "그때 말한 것"으로 흘러가버린다.
아이디어가 구조화된 문서로 쌓이지 않으면 파이프라인의 입력이 될 수 없고, 컴파운드 개선이 불가능하다.

## 핵심 질문

1. 대화에서 개선 아이디어를 어떻게 추출·분류하는가?
2. 추출된 아이디어를 어디에, 어떤 형식으로 쌓는가?
3. 쌓인 아이디어가 skill / 티켓 / 파이프라인으로 이어지는 흐름은?

## 설계 방향

### 아이디어 캡처 구조

세션 종료 시 대화에서 아래 유형의 내용을 추출한다:

| 유형 | 예시 | 저장 위치 |
|------|------|-----------|
| **패턴 불편함** | "이거 매번 직접 입력해야 돼서 귀찮아" | skill 후보 |
| **시스템 한계** | "이 구조로는 나중에 관리가 안 될 것 같아" | 티켓 후보 |
| **새로운 관찰** | "이렇게 하니까 더 빠르더라" | context-hub 인사이트 |
| **가설/실험 아이디어** | "이렇게 바꾸면 어떻게 될까?" | 티켓 후보 |

### 아이디어 문서 포맷

```markdown
---
captured: YYYY-MM-DD
source_thread: {threadId}
type: skill-candidate | ticket-candidate | insight
status: raw | reviewed | actioned
---

## 관찰
(대화에서 나온 원문 또는 요약)

## 의미
(왜 이게 개선 포인트인지)

## 다음 단계
(skill 작성 / 티켓 생성 / 보류)
```

저장 위치 후보: `ideas/YYYY-MM-DD-{slug}.md` (yeojin-context-hub 또는 claw)

### 컴파운드 흐름

```
대화 → 아이디어 추출 → ideas/ 저장
                              ↓ (주기적 검토)
                    skill 후보 → SKILL.md
                    티켓 후보 → tickets/
                    인사이트 → context-hub 문서
```

주기적 검토: 매 세션 마무리 시 `ideas/`에서 `raw` 상태 목록 확인 → 우선순위 판단 → actioned 처리

## 작업 항목

### Phase 0 — 포맷·위치 결정

- [ ] `ideas/` 폴더를 claw repo에 둘지, yeojin-context-hub에 둘지 결정
  - claw: 시스템 개선 아이디어 중심 → claw repo가 적합
  - context-hub: 개인 인사이트·관찰 중심 → context-hub이 적합
  - 두 곳 모두: 유형별 분리
- [ ] `ideas/` 문서 frontmatter 스키마 확정

### Phase 1 — session-wrap 통합

- [ ] session-wrap 1단계(advisor 위임) 에 아이디어 추출 단계 추가
  - advisor가 대화 요약 + 아이디어 목록을 같이 반환
- [ ] 추출된 아이디어를 `ideas/` 에 자동 저장 (에이전트 처리)
- [ ] 기존 `raw` 아이디어 목록을 세션 시작 시 claw가 브리핑

### Phase 2 — 주기 검토 파이프라인

- [ ] 주 1회 `ideas/` 검토 루틴 설계 (수동 트리거 or 자동)
- [ ] `reviewed` → `actioned` 전환 기준 정의
- [ ] 완료된 아이디어를 changelog / commit에 연결

## 참고

- `tickets/0009-context-quality-verification.md` — 검증 기준과 맞물림 (아이디어 중 드리프트 관련은 0009로)
- `skills/session-wrap/SKILL.md` — Phase 1 완료 후 1단계 수정 예정
