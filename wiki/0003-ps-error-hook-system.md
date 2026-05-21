---
title: PowerShell 오류 자동 기록 시스템
created: 2026-05-21
tickets: 0006, 0007
status: completed
---

# PowerShell 오류 자동 기록 시스템

## 개요

Windows PowerShell 7.6.x 환경에서 발생하는 오류를 두 가지 경로로 기록하는 시스템.

| 경로 | 트리거 | 대상 섹션 |
|------|--------|-----------|
| 수동 (0006) | 유저가 "기록해줘" 명시 | `## 기록된 이슈` (검증됨) |
| 자동 hook (0007) | PostToolUse 오류 감지 | `## 추가 예정` (미검증) |

## 파일 구조

```
claw/
├── skills/window-powershell-issue-writer/SKILL.md  # 수동 경로
├── .claude/
│   ├── settings.json                                # hook 등록
│   └── hooks/ps-error-logger.ps1                   # 자동 경로
└── notes/windows-ps76-issues.md                    # 이슈 로그 SSOT
```

## 자동 hook 동작 방식

```
PowerShell 도구 실행
  → PostToolUse/PostToolUseFailure 이벤트 발생
  → ps-error-logger.ps1 실행 (stdin: JSON payload)
  → 오류 감지: exit_code != 0 OR stderr에 실제 오류 패턴
  → notes/windows-ps76-issues.md의 <!-- ps76-pending-anchor --> 뒤에 append
```

## 오류 감지 조건

```powershell
# 실제 오류 패턴 (NativeCommandError 오탐 방지 목적으로 substring 검색 금지)
$is_real_error = $stderr -match "Error:|Exception:|Cannot find|Access is denied|command not found|not recognized as"

# NativeCommandError + exit_code=0 → false positive (git push 진행 상황 등)
$is_native_fp = ($stderr -match "NativeCommandError") -and ($exit_code -eq 0) -and (-not $is_real_error)
```

## 설계 결정 기록

**[2026-05-21] `-replace` → `LastIndexOf` 기반 삽입**
- 이유: `-replace`는 파일 전체에서 패턴을 치환하므로 코드블록 내 anchor 예시도 함께 치환됨
- 결정: `LastIndexOf`로 마지막 anchor 위치만 찾아 string 직접 조작

**[2026-05-21] 한글 리터럴 금지 원칙 확립**
- 이유: Claude Code Write 도구가 BOM 없는 UTF-8로 저장, SYSTEM 계정 PS가 Windows-1252로 파싱
- 결정: `.ps1` 소스코드는 ASCII-only. 한글이 필요한 마커는 HTML 주석 anchor로 대체

**[2026-05-21] 수동/자동 경로 분리**
- 이유: 자동 감지만 있으면 검증 전 항목이 `## 기록된 이슈`에 오염될 수 있음
- 결정: 자동 → 미검증 섹션, 수동 → 검증된 섹션으로 분리

## 알려진 제약

- `settings.json`에 `async` 필드 없음: timeout=5000ms 상한으로 실용적 문제 없으나 hook이 동기적으로 실행됨
- hook payload 스키마(`tool_result.exit_code`)는 테스트로 검증했으나 Claude Code 공식 문서 확인 미완료
- `"PowerShell"` matcher 실제 도구 이름 일치 여부는 실제 세션에서 검증 필요
