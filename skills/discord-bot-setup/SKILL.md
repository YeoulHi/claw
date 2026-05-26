---
name: discord-bot-setup
description: 새 Discord 봇 레포 설정 또는 별도 봇 구현 시 표준 체크리스트 주입
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

## 환경 전제 (Windows 11 / pwsh 7.6.x / NSSM)

- OS: Windows 11 Home (DUWLS)
- Shell: PowerShell 7.6.x (`$env:VAR`, 백틱 줄 연속, `&&`/`||` OK)
- Process supervisor: **NSSM 서비스** (LocalSystem). macOS `launchd` / `launchctl` 패턴은 사용하지 않는다.
- Git remote: HTTPS 고정 (LocalSystem 환경에서 SSH push 불가)

## 구현 시작 전 필수 확인
- 어떤 Discord 봇(BOT_TOKEN / Discord Application)에 붙이는가?
- 현재 claw bot과 다른 봇인 경우, 별도 레포 및 NSSM 서비스 인스턴스가 필요한지 확인
- 봇 토큰이 대화에 평문으로 공유된 경우, 즉시 재발급 안내 후 새 토큰 수신 전까지 대기

## 새 봇 레포 필수 포함 요소

1. **세션 영속화**: threadId → sessionId를 SQLite 또는 JSON 파일로 영속 저장 (재시작 후 기존 세션 resume 유지)
2. **재시작 마커 패턴**: `__BOTNAME_RESTART__` 감지 → `await postChunks()` 완료 후 `process.exit(0)` 호출. NSSM이 자동 재기동한다 (setTimeout 없이 순서 보장).
3. **NSSM 서비스 등록**: 프로세스 크래시 시 자동 재시작을 NSSM에 위임.
   ```powershell
   # 관리자 pwsh
   nssm install <botname> "C:\Program Files\nodejs\node.exe" "C:\path\to\dist\index.js"
   nssm set <botname> AppDirectory "C:\path\to"
   nssm set <botname> AppEnvironmentExtra "NODE_ENV=production`nBOT_TOKEN=..."
   nssm set <botname> Start SERVICE_AUTO_START
   nssm set <botname> ObjectName LocalSystem
   Start-Service <botname>
   ```
   환경변수 갱신 후에는 `Restart-Service <botname>` 필요.
4. **AGENTS.md / OPS.md**: 마커 규칙·NSSM 재시작 경로·환경변수 주입 명령 명시 (Windows 정본).
5. **보안**: 토큰은 NSSM `AppEnvironmentExtra` 또는 `.env`에만 보관, 대화 평문 공유 감지 시 즉시 재발급 안내. `.env`는 `.gitignore`에 포함.
6. **codex 엔진 spawn 패턴**(claw 형제 봇인 경우): `CODEX_BIN`(`codex.exe` 절대경로) + `CODEX_HOME` 환경변수 필수, `--sandbox danger-full-access`로 실행. npm wrapper(`codex.ps1`)는 spawn 불가.
7. **Git remote**: `git remote set-url origin https://github.com/<owner>/<repo>` (HTTPS 고정), `gh auth setup-git`로 `$env:GH_TOKEN` 자동 연동.

## 운영 명령 요약 (pwsh)

| 작업 | 명령 |
|------|------|
| 재시작 | `Restart-Service <botname>` (관리자 pwsh) 또는 마커 → `process.exit(0)` |
| 시작/중지 | `Start-Service <botname>` / `Stop-Service <botname>` |
| 환경변수 갱신 | `nssm set <botname> AppEnvironmentExtra "K=V`nK2=V2"` → `Restart-Service` |
| 상태 확인 | `Get-Service <botname> | Select-Object Status, StartType` |
| 포트 확인 | `Get-NetTCPConnection -LocalPort <port>` |

## 보안 인터럽트
대화에서 Discord 봇 토큰 패턴(MTQ로 시작하는 긴 문자열)이 감지되면 즉시:
> '토큰이 대화에 포함됐습니다. Discord Developer Portal에서 반드시 재발급 후 NSSM `AppEnvironmentExtra` 또는 `.env`를 업데이트해주세요. 새 토큰을 공유해주시면 계속 진행하겠습니다.'