# claw GPT-5.5 + Windows + PowerShell 7.6.x 매핑 SSOT

> claw가 codex(GPT-5.5) 엔진 + Windows + NSSM LocalSystem 환경에서 운용된다는 사실을 SSOT로 박은 매핑 표.
> AGENTS.md / prompt.ts / skills 모두 이 문서를 reference로 정렬한다.

---

## 1. 실행 환경 — 고정 사실

| 항목 | 값 |
|---|---|
| Engine | OpenAI codex (CLI) |
| Model | gpt-5.5 (`~/.codex/config.toml`의 `model`) |
| OS | Windows 11 Home (DUWLS) |
| Shell | PowerShell 7.6.x (pwsh) |
| Process supervisor | NSSM 서비스 `claw` (StartName `LocalSystem`, 부팅 시 자동 시작) |
| Env vars 주입 경로 | `nssm set claw AppEnvironmentExtra "K=V`nK2=V2"` |
| codex auth | `C:\Users\yeoul\.codex\auth.json` (ChatGPT 구독 OAuth) — LocalSystem 접근 위해 `CODEX_HOME=C:\Users\yeoul\.codex` 환경변수 필수 |
| codex 바이너리 | npm wrapper(`codex.ps1`)는 spawn 불가 → `CODEX_BIN=C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin\<hash>\codex.exe` 직접 지정 |
| codex sandbox | `--sandbox danger-full-access` (=YOLO. `~/.codex/config.toml`에 `approval_policy = "never"`, `sandbox_mode = "danger-full-access"`) |
| Git remote | HTTPS 고정 (`https://github.com/<owner>/<repo>`) — DUWLS LocalSystem 환경에서 SSH push 불가 |
| GH token | `$env:GH_TOKEN` (PowerShell profile에서 `gh auth token`으로 자동 로드) |

claw runtime은 Codex OAuth만 사용한다. `CLAUDE_CODE_OAUTH_TOKEN`은 config schema와 `.env.example`에서 제거하며, Codex 인증은 `CODEX_HOME\auth.json`을 SSOT로 본다.

---

## 2. macOS / Claude Code → Windows / codex 어휘 매핑

| 영역 | macOS / Claude Code (기존) | Windows / codex (현재 정본) |
|---|---|---|
| 재시작 | `launchctl kickstart -k gui/<uid>/com.claw` | `Restart-Service claw` (관리자 PS) 또는 응답에 `__CLAW_RESTART__` 마커 → `process.exit(0)` → NSSM auto-restart |
| Sandbox 우회 | `--dangerously-skip-permissions` (Claude Code) | `--sandbox danger-full-access` (codex exec) |
| Default model | `claude-haiku-4-5-20251001` 등 | `gpt-5.5` |
| Skills 시스템 | `.claude/skills/{name}/SKILL.md` | claw 자체 `claw/skills/{name}/SKILL.md` (Haiku 분류기 → systemAppend 주입), repo는 `.codex/skills/` 또는 `.claude/skills/` (codex가 cwd에서 자동 검색) |
| Build | `pnpm build` (동일) | `pnpm build` (동일) |
| Restart 후 변경 반영 확인 | NSSM 로그 `commit` 해시 | 동일 |
| Home dir | `~/...` | `$env:USERPROFILE\...` 또는 절대경로 `C:\Users\yeoul\...` |
| Shell 명령 | bash | pwsh 7.6.x (PowerShell 7+) |
| 줄 연속 | `\` (bash) | 백틱 `` ` `` (PowerShell) |
| 환경변수 | `$VAR` | `$env:VAR` |
| dev/null 리다이렉트 | `2>/dev/null` | `2>$null` |
| 명령 체인 | `&&`, `||` (bash, pwsh 7+ 동일) | 동일 (pwsh 7+에서 `&&` `||` 지원) |
| Process 종료 | `kill -9` | `Stop-Process -Id <PID> -Force` 또는 `taskkill /PID <PID> /F` |
| Port 확인 | `lsof -i :3200` | `Get-NetTCPConnection -LocalPort 3200` 또는 `netstat -ano \| findstr ":3200"` |

---

## 3. codex / GPT-5.5 고유 기능 — 활용 가이드

### 3-1. 활성화된 기능 (`~/.codex/config.toml` 기준)

| 기능 | 설정 키 | 의미 / 활용 방법 |
|---|---|---|
| Web 검색 | `web_search = "cached"` | codex가 응답 중 자체적으로 웹 검색 수행. WebFetch/WebSearch 별도 호출 불필요 — 단, 캐시 우선이므로 최신성 필요 시 명시. |
| 멀티 에이전트 | `multi_agent = true` | codex가 내부적으로 sub-agent 분기 가능. "이 작업 병렬로 처리해" 류 발화에 활용. |
| Node REPL MCP | `mcp_servers.node_repl` | JS/Node 코드 실행 가능. 계산·파싱·간단 스크립팅. |
| Documents/Sheets/Slides | `plugins."documents@openai-primary-runtime"` 등 | PDF/Excel/PPT 생성·읽기. 산출물 생성 시 활용. |
| Shell snapshot | `features.shell_snapshot = true` | 이전 shell 상태(env, cwd) 일부 복원. 세션 연속성. |
| Goals | `features.goals = true` | codex 내부 목표 트래킹. 멀티스텝 작업 활용. |

### 3-2. 응답 포맷 — Discord 출력

- codex의 `model_reasoning_summary = "auto"` 가 자동으로 reasoning summary를 추출. claw의 `## 🤔 align` / `## 💬 thinking` 헤딩 포맷과 **충돌하지 않게** 유지:
  - claw가 요구하는 align/thinking은 **사용자 향한 사고 노출**(Discord 가독성용).
  - codex 내부 reasoning summary는 **모델 자체 생성**이며 별도로 응답 본문에 노출 안 됨 (text 채널만 추출 — `codex.ts` `extractItemText` 참조).
  - 따라서 prompt.ts에서 align/thinking 블록을 명시 지시하면 그대로 동작.

### 3-3. Sandbox / 권한

- codex는 `--sandbox danger-full-access` 로 실행되므로 모든 셸 명령·파일 쓰기 가능.
- Claude Code의 `--dangerously-skip-permissions`와 동등.
- 별도 권한 승인 단계 없음 (`approval_policy = "never"`).

---

## 4. Git / GitHub — Windows LocalSystem 환경

- **HTTPS 고정**: `git remote set-url origin https://github.com/<owner>/<repo>` (SSH push 불가)
- **인증**: `gh auth setup-git` (GH_TOKEN 자동 인식, idempotent)
- **push 스크립트**: `scripts/git-push.ps1 -Rebase` (pull --rebase → push)
- **금지**: `-f` 강제 push, `--no-verify`, `--no-gpg-sign` (사용자 명시 요청 시에만)

---

## 5. NSSM 운영 명령

| 작업 | 명령 |
|---|---|
| 환경변수 추가 | `nssm set claw AppEnvironmentExtra "K=V`nK2=V2"` (관리자 PS) |
| 환경변수 확인 | `nssm get claw AppEnvironmentExtra` |
| 서비스 계정 변경 | `nssm set claw ObjectName ".\yeoul" "<password>"` (Windows 로그인 패스워드 필요) |
| 서비스 계정 원복 | `nssm set claw ObjectName "LocalSystem"` |
| 재시작 | `Restart-Service claw` (관리자 PS) |
| 시작/중지 | `Start-Service claw` / `Stop-Service claw` |
| 로그 위치 확인 | `nssm get claw AppStdout` / `nssm get claw AppStderr` |

---

## 6. 경로 SSOT

| 자산 | 절대경로 |
|---|---|
| claw repo | `C:\yeojin-context-hub\claw` |
| dist | `C:\yeojin-context-hub\claw\dist` |
| DB | `C:\yeojin-context-hub\claw\data\claw.db` |
| Logs | `C:\yeojin-context-hub\claw\logs` |
| Dashboard | `http://localhost:3200` |
| codex auth | `C:\Users\yeoul\.codex\auth.json` |
| codex config | `C:\Users\yeoul\.codex\config.toml` |
| codex sessions | `C:\Users\yeoul\.codex\sessions\` (NSSM LocalSystem 환경에서는 `CODEX_HOME=C:\Users\yeoul\.codex` 환경변수 지정 필수) |
| codex exe | `C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin\<hash>\codex.exe` |

---

## 7. 빌드 흐름

```powershell
Set-Location C:\yeojin-context-hub\claw
pnpm build  # tsc → src/ → dist/
Restart-Service claw  # 관리자 PS — 새 dist 로드
```

또는 Discord `#claw` 채널에서 "재시작해줘" → 응답에 `__CLAW_RESTART__` 마커 포함 → 자동 재시작.

---

## 8. 검증·dry-run 명령 (eval용)

| 검증 대상 | 명령 |
|---|---|
| codex 인증 상태 | `codex --version` (응답에 "Logged in using ChatGPT" 포함) |
| 서비스 상태 | `Get-Service claw \| Select-Object Status, StartType` |
| 환경변수 적용 확인 | `nssm get claw AppEnvironmentExtra` |
| 빌드 commit 반영 | `Get-Item C:\yeojin-context-hub\claw\dist\codex.js \| Select-Object LastWriteTime` |
| Port 3200 점유 | `Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue` |
| 최근 서비스 시작 로그 | `Get-WinEvent -LogName System -MaxEvents 20 \| Where-Object { $_.Message -match "claw" }` |

---

## 9. 4-agent 작업 분할 시 공통 invariant

모든 agent는 이 문서를 reference로 받아 다음을 보장한다:

1. macOS 명령어(`launchctl`, `~/`, `lsof`, `kill -9` 등) **잔재 0건**
2. 셸 어휘는 **pwsh 7.6.x 기준** (`$env:VAR`, 백틱 줄 연속, `&&`/`||` OK)
3. 엔진 어휘는 **codex 기준** (`--sandbox danger-full-access`, `gpt-5.5`)
4. 재시작 경로는 **NSSM 정본** (`Restart-Service claw` 또는 `__CLAW_RESTART__` 마커)
5. Git remote는 **HTTPS 가정**, `gh auth setup-git` 한 번 실행 idempotent
6. **src/ 만 수정** — dist/ 직접 편집 금지. 빌드는 마지막에 한 번만.

이 6개 invariant가 깨지면 eval에서 감점.
