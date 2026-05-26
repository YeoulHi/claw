---
name: discord-bot-setup
description: 새 Discord 봇 레포 설정 또는 별도 봇 구현 시 Windows/NSSM 표준 체크리스트 주입
triggers:
  - 새 봇
  - 별도 봇
  - 별도 discord application
  - 새 discord bot
  - bot 레포 만들
  - discord bot 구현
  - discord bot 설정
---

# Discord 봇 설정 표준 체크리스트

## 3-Cycle 점검 기준

- Cycle 1: 새 봇이 단순 안내인지, 실제 레포/서비스 구현인지 구분한다. 구현은 advisor가 맡는다.
- Cycle 2: Windows 11 + PowerShell 7.6.x + NSSM 기준으로 명령을 작성한다. bash/macOS 패턴은 금지한다.
- Cycle 3: 설정 후 서비스/포트/버전 dry-run 검증과 Discord 출력 계약을 확인한다.

## 역할 경계

- claw: 봇 설정 체크리스트 안내, 토큰 보안 경고, 짧은 초안/설명.
- advisor: 레포 생성, 파일 수정, NSSM 서비스 등록 스크립트 작성, git commit/push.
- 스키마, 서비스명, 포트, 저장소 구조 결정이 필요하면 즉시 advisor에게 위임한다.

고지 예시:

> → 새 Discord 봇 서비스 구조 결정이 필요해 advisor에게 위임했습니다.

## 환경 전제

- OS: Windows 11 Home (DUWLS)
- Shell: PowerShell 7.6.x (`$env:VAR`, 백틱 줄 연속, `&&`/`||` 사용 가능)
- Supervisor: NSSM 서비스(LocalSystem)
- Git remote: HTTPS 고정. LocalSystem 환경에서 SSH push는 사용하지 않는다.
- codex 형제 봇이면 `codex.exe` 절대경로와 `CODEX_HOME`을 명시한다.

## 구현 시작 전 확인

- 어떤 Discord Application/BOT_TOKEN에 붙일 것인가?
- 현재 `claw` 봇과 별도 봇이면 별도 repo, 포트, NSSM 서비스명이 필요한가?
- 토큰이 대화에 평문으로 공유되었는가? 공유되었다면 즉시 재발급을 안내하고 새 토큰 수신 전 진행하지 않는다.
- 메시지 길이, artifact JSON, 재시작 마커 등 Discord 출력 계약이 필요한가?

## 새 봇 필수 포함 요소

1. 세션 영속화: `threadId -> sessionId`를 SQLite 또는 JSON 파일로 저장한다.
2. 재시작 마커: `__BOTNAME_RESTART__` 감지 후 응답 전송 완료 뒤 `process.exit(0)`를 호출한다.
3. NSSM 서비스 등록: 프로세스 크래시와 재부팅 후 자동 시작은 NSSM에 맡긴다.
4. 운영 문서: `AGENTS.md` 또는 `OPS.md`에 마커, 재시작, 환경변수, 검증 명령을 기록한다.
5. 보안: 토큰은 NSSM `AppEnvironmentExtra` 또는 `.env`에만 저장하고 `.env`는 gitignore에 둔다.
6. codex spawn: npm wrapper 대신 `codex.exe` 절대경로를 사용하고 `--sandbox danger-full-access`를 명시한다.
7. Git: `gh auth setup-git` 후 HTTPS remote로 push한다.

## NSSM 등록 예시

```powershell
# 관리자 pwsh
nssm install <botname> 'C:\Program Files\nodejs\node.exe' 'C:\path\to\dist\index.js'
nssm set <botname> AppDirectory 'C:\path\to'
nssm set <botname> AppEnvironmentExtra "NODE_ENV=production`nBOT_TOKEN=..."
nssm set <botname> Start SERVICE_AUTO_START
nssm set <botname> ObjectName LocalSystem
Start-Service <botname>
Get-Service <botname> | Select-Object Status, StartType
```

환경변수 갱신 후에는 재시작한다.

```powershell
nssm set <botname> AppEnvironmentExtra "NODE_ENV=production`nBOT_TOKEN=..."
Restart-Service <botname>
Get-Service <botname> | Select-Object Status, StartType
```

## 운영 명령 요약

| 작업 | 명령 |
|---|---|
| 시작 | `Start-Service <botname>` |
| 중지 | `Stop-Service <botname>` |
| 재시작 | `Restart-Service <botname>` |
| 상태 확인 | `Get-Service <botname> | Select-Object Status, StartType` |
| 포트 확인 | `Get-NetTCPConnection -LocalPort <port> -ErrorAction SilentlyContinue` |
| Node 확인 | `node --version` |
| codex 확인 | `codex --version` |
| stdout 경로 | `nssm get <botname> AppStdout` |
| stderr 경로 | `nssm get <botname> AppStderr` |

## Git/Push 규율

advisor가 파일 변경을 완료한 뒤에만 수행한다.

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

## 보안 인터럽트

대화에서 Discord 봇 토큰 패턴이 감지되면 즉시 안내한다.

> 토큰이 대화에 포함됐습니다. Discord Developer Portal에서 반드시 재발급한 뒤 NSSM `AppEnvironmentExtra` 또는 `.env`를 업데이트해주세요. 새 토큰은 평문으로 다시 붙여넣지 말고 안전한 주입 경로를 먼저 정하겠습니다.

## Discord 출력 계약

최종 보고는 다음 3단 구조를 지킨다.

```text
구현 내용
- ...

검증 결과
- ...

다음 단계
- ...
```

파일 또는 URL 산출물이 있으면 마지막 줄에만 artifact JSON을 붙인다.
