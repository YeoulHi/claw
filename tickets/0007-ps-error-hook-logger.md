---
id: "0007"
title: PostToolUse hook 기반 PowerShell 오류 자동 기록
type: one-off
cluster: infra
status: active
eval: ~
created: 2026-05-21
---

## 목표

PowerShell 도구 실행 중 오류가 감지되면 Claude hooks가 자동으로
`notes/windows-ps76-issues.md`의 `## 추가 예정` 섹션에 append한다.
유저 요청 없이 동작하는 proactive 기록 시스템.

## advisor 논의 결론 (2026-05-21)

- **Hook 이벤트**: `PostToolUse` + `PostToolUseFailure`, matcher=`PowerShell`
- **오류 감지 조건**: exit_code != 0 OR stderr에 Error/Exception/NativeCommandError/command not found 포함
- **기록 위치**: `## 추가 예정 (미검증)` 섹션 (자동 기록이므로 검증 전)
- **스크립트 언어**: PowerShell (SYSTEM 계정 환경, jq 없을 수 있음)
- **Blocking 여부**: async=true, Claude 응답 블록 없음
- **오탐 방지**: exit_code=0 이면서 stderr=NativeCommandError만 있는 경우 skip

## 기록 포맷 (auto-generated)

```markdown
### [YYYY-MM-DD] PS 자동 감지: <명령어 앞 60자>

**증상:** `<command>` 실행 시 `<stderr 첫 줄>`
**원인:** (auto-logged — 미확인)
**해결책:** (미확인 — 수동 조사 필요)
**참고:** auto-logged by PostToolUse hook (exit_code=N)
```

## 산출물

- `.claude/hooks/ps-error-logger.ps1` — 오류 감지 + append 스크립트
- `.claude/settings.json` — PostToolUse/PostToolUseFailure hook 등록

## 구현 순서 (steps)

1. `.claude/hooks/ps-error-logger.ps1` 작성
2. 단독 실행 검증: 샘플 JSON을 stdin으로 주입해 notes 파일 append 확인
3. 정상 케이스 검증: exit_code=0인 경우 skip 동작 확인
4. `.claude/settings.json` 작성 (hook 등록)
5. Claude Code 세션에서 실제 오류 유발 → notes 파일 확인

## 검증 시나리오

- `Get-Item "C:\nonexistent-path"` → notes에 항목 append 확인
- `git push origin main` 정상 실행 → 노이즈 없음 확인 (NativeCommandError 오탐 방지)
- append 위치가 `## 추가 예정` 섹션인지 확인

## 선행 조건

없음
