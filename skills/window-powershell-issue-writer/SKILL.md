---
name: window-powershell-issue-writer
description: Windows PowerShell 7.6.x 이슈를 claw/notes/windows-ps76-issues.md에 append-only로 기록
triggers:
  - PS 이슈 기록
  - PowerShell 이슈 로그에 추가
  - PS 버그 기록해줘
  - 이슈 로그에 추가해줘
  - windows-ps76-issues에 추가
  - PowerShell 이슈 추가해줘
  - PS 오류 기록
---

# Windows PowerShell 이슈 기록 지침

## 3-Cycle 점검 기준

- Cycle 1: 기록 요청인지, 실제 수정/디버깅 요청인지 구분한다. 이 skill은 기록만 담당한다.
- Cycle 2: PowerShell 7.6.x 기준으로 재현 명령과 해결책을 정리한다. bash 어휘(`$VAR`, `/dev/null`, `~/`, `\` 줄 연속)는 pwsh 표현으로 바꾼다.
- Cycle 3: 해결책이 검증됐는지 확인한다. 미검증이면 pending 섹션에 기록한다.

## 역할 경계

- claw: 사용자가 제공한 PowerShell 이슈를 정리하고 기록 요청을 advisor에게 넘길지 판단한다.
- advisor: `claw/notes/windows-ps76-issues.md` 파일 append, git commit/push, 검증 명령 실행.
- 단순 설명은 claw가 처리할 수 있지만, 레포 파일 기록은 advisor에게 위임한다.

고지 예시:

> → PowerShell 이슈 로그 파일 수정이 필요해 advisor에게 위임했습니다.

## 대상 파일

`claw/notes/windows-ps76-issues.md`

## 기록 포맷

```markdown
### [YYYY-MM-DD] 제목

**증상:** 어떤 명령/상황에서 어떤 오류가 났는지
**원인:** 왜 발생했는지
**해결책:** 검증된 대응 방법
**검증:** 직접 실행했거나 dry-run한 pwsh 명령과 결과
**참고:** 관련 커밋/문서 (없으면 생략)
```

## 절차

1. 사용자가 제공한 정보를 위 포맷으로 정리한다.
2. 해결책이 검증됐으면 `## 기록된 이슈` 섹션 마지막 항목 뒤에 append한다.
3. 해결책이 미검증이면 `<!-- ps76-pending-anchor -->` 아래 `## 추가 예정 (미검증)` 섹션에 append한다.
4. 기존 항목은 수정하지 않는다. append-only 원칙을 지킨다.

## PowerShell 표현 변환 규칙

| 금지 표현 | pwsh 기준 |
|---|---|
| `$VAR` | `$env:VAR` |
| `~/path` | `$env:USERPROFILE\path` 또는 절대경로 |
| `/dev/null` | `2>$null` 또는 `>$null` |
| `\` 줄 연속 | 백틱(``) 줄 연속 |
| `lsof -i :3200` | `Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue` |
| `kill -9 <PID>` | `Stop-Process -Id <PID> -Force` |
| `which codex` | `Get-Command codex` |

## 검증 예시

```powershell
$PSVersionTable.PSVersion
Get-Command codex
codex --version
Get-Service claw | Select-Object Status, StartType
Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue
```

## 원칙

- 검증된 해결책만 `## 기록된 이슈`에 기록한다.
- 추측은 금지한다. 미검증이면 pending으로 둔다.
- 파일 append가 반복되는 워크플로우로 굳어지면 이 skill에 새 패턴 추가를 먼저 제안한다.
- 최종 Discord 보고는 `구현 내용`, `검증 결과`, `다음 단계` 3단 구조로 짧게 쓴다.
