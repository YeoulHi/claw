---
id: "0006"
title: window-powershell-issue-writer skill 구축
type: one-off
cluster: infra
status: completed
eval: skill-authoring
created: 2026-05-21
---

## 목표

Windows PowerShell 7.6.x 이슈를 명시적 요청 시 `notes/windows-ps76-issues.md`에 자동 기록하는 claw skill을 만든다.

## advisor 논의 결론 (2026-05-21)

- **구현 방식**: claw skill (SKILL.md 단일 파일) — 빌드/재시작 불필요
- **트리거**: 명시적 요청만 ("기록해줘", "이슈 추가해줘") — 자동 감지는 파일 오염 위험
- **파일 수정 주체**: advisor가 Edit 도구로 append — 현재 아키텍처에서 검증된 경로
- **범위**: 로그 작성만 (이슈 해결 X)

## 실행 흐름

```
유저: "이 이슈 기록해줘"
  → Haiku: window-powershell-issue-writer skill 감지
  → 메인 LLM systemAppend에 SKILL.md 내용 주입
  → LLM이 advisor(Claude Code)에게 파일 수정 위임
  → advisor: Edit 도구로 notes/windows-ps76-issues.md에 append
```

## 산출물

- `skills/window-powershell-issue-writer/SKILL.md`

## eval 결과

eval: skill-authoring — **APPROVED** (2026-05-21)
- name/description/triggers: PASS
- triggers 7개, 실제 사용자 표현 반영: PASS
- systemAppend 단독 주입 시 자립적: PASS (cycle 2에서 절차 표현 명확화)
- 스크립트/외부 라이브러리: SKIP (해당 없음)

## 선행 조건

없음 (스크립트/외부 라이브러리 없으므로 실행 검증 없이 작성 가능)
