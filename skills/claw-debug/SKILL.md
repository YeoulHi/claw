---
name: claw-debug
description: claw 시스템 진단, 재시작/포트/빌드/큐/세션 등 운영 이슈 처리. 정본은 claw/OPS.md.
triggers:
  - claw 버그
  - claw 재시작
  - 재시작 안 됨
  - 포트 충돌
  - EADDRINUSE
  - 3200
  - Access is denied
  - 액세스가 거부
  - 거부되었습니다
  - 메시지 누락
  - 큐 적체
  - 중복 실행
  - 세션 꼬임
  - launchctl
  - claw 응답 없음
  - 빌드 반영 안 됨
---

# Claw 디버깅 지침

## 3-Cycle 점검 기준

- Cycle 1: 증상과 범위를 분리한다. 레포 파일 수정, 스키마, 코드 변경이 필요하면 claw가 직접 처리하지 않고 advisor에게 위임한다.
- Cycle 2: Windows pwsh 7.6.x 기준 명령만 사용한다. bash 어휘(`$VAR`, `/dev/null`, `~/`, `kill -9`, `lsof`, `launchctl`)는 금지하고 pwsh/NSSM 명령으로 치환한다.
- Cycle 3: 검증 명령을 직접 실행하거나 dry-run으로 확인하고, Discord에는 핵심만 보고한다.

## 역할 경계

- claw: Discord 진입점과 오케스트레이터. 단순 설명, 상태 안내, 메시지 작성, 가벼운 명령 안내를 처리한다.
- advisor: `C:\yeojin-context-hub` 레포 파일 읽기/수정/생성, git 커밋/푸시, 스키마/코드 구현, 운영 문서 갱신을 담당한다.
- 구조 판단, 데이터 설계, 반복 파일 수정, 원인 분석 후 패치가 필요하면 즉시 advisor에게 위임하고 한 줄로 고지한다.

고지 예시:

> → claw 운영 코드 수정이 필요해 advisor에게 위임했습니다.

## 환경 전제

- Windows 11 (DUWLS)
- PowerShell 7.6.x
- Node.js 24.x
- codex(GPT-5.5) CLI, `--sandbox danger-full-access`
- NSSM `claw` 서비스 supervisor
- 정본 문서: `claw/OPS.md`
- 환경 매핑 SSOT: `claw/docs/gpt55-windows-mapping.md`

## 빠른 의사결정

| 상황 | 1순위 액션 |
|---|---|
| 코드 변경 후 반영 필요 | `pnpm build` 후 관리자 pwsh에서 `Restart-Service claw` 또는 Discord 응답에 재시작 마커 포함 |
| `EADDRINUSE :::3200` | NSSM `claw` 서비스 상태와 포트 점유를 확인한다. PID kill 전에 `Restart-Service claw`를 우선한다. |
| `Access is denied` | LocalSystem 권한 이슈로 본다. 사용자 권한 PID kill을 반복하지 말고 관리자 pwsh 또는 재시작 마커로 처리한다. |
| Discord 응답 없음 | NSSM stdout/stderr, `logs/`, `data/claw.db`의 `message_queue`를 확인한다. |
| 빈 메시지 송신 | `__CLAW_RESTART__`만 단독 출력하지 않는다. 사람에게 보이는 설명 한 줄 뒤에 마커를 둔다. |
| 포트 점유 확인 | `Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue` |
| 서비스 상태 확인 | `Get-Service claw | Select-Object Status, StartType` |
| 프로세스 종료 필요 | `Stop-Process -Id <PID> -Force` 또는 `taskkill /PID <PID> /F` |

## 디버깅 절차

1. 상태 확인:

   ```powershell
   Get-Service claw | Select-Object Status, StartType
   Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue
   codex --version
   ```

2. 로그 확인:

   ```powershell
   nssm get claw AppStdout
   nssm get claw AppStderr
   ```

3. 큐/이벤트 확인이 필요하면 advisor에게 위임한다. 레포 DB 조회와 파일 수정은 advisor 범위다.

4. 소스 수정이 있으면 advisor가 다음 순서로 처리한다:

   ```powershell
   pnpm build
   Get-Service claw | Select-Object Status, StartType
   Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue
   ```

5. 반복 재사용 가능한 운영 절차가 생기면 관련 skill에 패턴 추가를 먼저 제안한다.

## Git/Push 규율

advisor가 레포 변경을 완료한 경우에만 수행한다.

```powershell
gh auth setup-git
$remote = git remote get-url origin
if ($remote -like 'git@github.com:*') {
  $https = $remote -replace '^git@github.com:', 'https://github.com/' -replace '\.git$', ''
  git remote set-url origin $https
}
git status --short
git push
```

강행 금지: `git push -f`, `--no-verify`, `--no-gpg-sign`.

## Discord 출력 계약

최종 보고는 2000자 안에 핵심만 쓴다.

```text
구현 내용
- ...

검증 결과
- `Get-Service claw | Select-Object Status, StartType`: ...
- `Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue`: ...

다음 단계
- ...
```

파일이나 URL 산출물이 있으면 마지막 줄에 artifact JSON을 붙인다.

```text
__CLAW_ARTIFACT__ {"kind":"file","path":"C:\\absolute\\path\\file.pdf","caption":"설명"}
__CLAW_ARTIFACT__ {"kind":"url","url":"https://example.com","caption":"설명"}
```
