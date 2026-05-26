# claw — codex(GPT-5.5) 작업 지침

> 운영 문제(재시작 실패, 포트 충돌, 빌드 반영 등)는 **[`OPS.md`](./OPS.md)** 정본 참조.
> 환경·어휘 매핑 SSOT는 **[`docs/gpt55-windows-mapping.md`](./docs/gpt55-windows-mapping.md)**. 이 파일은 그 SSOT를 작업 지침으로 풀어쓴 것.

---

## 실행 환경 사실 (고정)

| 항목 | 값 |
|---|---|
| Engine | OpenAI codex (CLI) |
| Model | `gpt-5.5` (`C:\Users\yeoul\.codex\config.toml`의 `model`) |
| OS | Windows 11 Home (DUWLS) |
| Shell | PowerShell 7.6.x (pwsh) — `&&` / `||` 사용 가능 |
| Process supervisor | NSSM 서비스 `claw` (StartName `LocalSystem`, 부팅 시 auto-start) |
| Sandbox | `--sandbox danger-full-access` (`approval_policy = "never"`) |
| codex auth | `C:\Users\yeoul\.codex\auth.json` (ChatGPT 구독 OAuth) — `CODEX_HOME=C:\Users\yeoul\.codex` 환경변수 필수 |
| codex 바이너리 | `CODEX_BIN=C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin\<hash>\codex.exe` (npm wrapper `codex.ps1`은 spawn 불가) |
| Home dir | `$env:USERPROFILE` 또는 절대경로 `C:\Users\yeoul\...` (절대 `~/` 쓰지 말 것) |
| Git remote | HTTPS 고정 (`https://github.com/<owner>/<repo>`) — LocalSystem 환경에서 SSH push 불가 |
| GH token | `$env:GH_TOKEN` (PowerShell profile에서 `gh auth token`으로 자동 로드) |

claw는 Codex OAuth만 사용한다. `CLAUDE_CODE_OAUTH_TOKEN`은 필요하지 않으며, config schema에서도 요구하지 않는다.

**셸 어휘 규칙 (pwsh 7.6.x):**
- 환경변수: `$env:VAR` (bash `$VAR` 금지)
- 줄 연속: 백틱 `` ` `` (bash `\` 금지)
- null 리다이렉트: `2>$null` (bash `2>/dev/null` 금지)
- 명령 체인: `&&` / `||` 사용 가능 (pwsh 7+)
- 프로세스 종료: `Stop-Process -Id <PID> -Force` 또는 `taskkill /PID <PID> /F` (bash `kill -9` 금지)
- 포트 확인: `Get-NetTCPConnection -LocalPort 3200` 또는 `netstat -ano | findstr ":3200"` (bash `lsof` 금지)

---

## 재시작 마커 (`__CLAW_RESTART__`) 사용 규칙

claw가 응답 본문에서 마커를 검출하면 제거 후 `process.exit(0)`로 종료한다. NSSM이 자동으로 재기동한다.
마커가 제거되면 남은 텍스트가 Discord에 전송되므로, **마커만 단독으로 출력하면 빈 메시지가 전달된다.**

**규칙: 마커 앞에 반드시 사람이 읽을 수 있는 텍스트를 한 줄 이상 포함할 것.**

```
# 올바른 예
재시작합니다.

__CLAW_RESTART__

# 잘못된 예 (Discord에 빈 메시지 전송됨)
__CLAW_RESTART__
```

**재시작 경로 (NSSM 정본):**
- 관리자 PS에서 직접: `Restart-Service claw`
- Discord 자연어 ("재시작해줘") → 마커 응답 → `process.exit(0)` → NSSM auto-restart
- macOS `launchctl`은 사용하지 않는다. 흔적 발견 시 즉시 NSSM 명령으로 교체.

---

## codex 고유 기능 활용

`C:\Users\yeoul\.codex\config.toml`에 활성화된 기능을 작업 시 의식적으로 활용한다.

| 기능 | 설정 키 | 활용 가이드 |
|---|---|---|
| Web 검색 | `web_search = "cached"` | codex가 응답 중 자체 웹 검색 수행. 별도 WebFetch/WebSearch 호출 불필요. 캐시 우선이므로 **최신성이 중요할 때만** "최신 정보로 다시 검색" 명시. |
| 멀티 에이전트 | `multi_agent = true` | codex가 내부 sub-agent 분기 가능. "이 작업 병렬로 처리해", "두 파일 동시에 분석해" 류 발화에 활용. |
| Node REPL MCP | `mcp_servers.node_repl` | JS/Node 코드 실행 가능. 계산·JSON 파싱·간단 스크립팅에 사용. shell 호출 대신 우선 시도. |
| Documents plugin | `plugins."documents@openai-primary-runtime"` | PDF 생성·읽기. 보고서·문서 산출물 요청 시 활용. |
| Spreadsheets plugin | `plugins."spreadsheets@..."` | Excel 생성·읽기. 표 데이터·시뮬레이션 산출물에 활용. |
| Presentations plugin | `plugins."presentations@..."` | PPT 생성. 발표 자료 요청 시 활용. |
| Shell snapshot | `features.shell_snapshot = true` | 이전 shell 상태(env, cwd) 일부 복원. 세션 연속성. |
| Goals | `features.goals = true` | 멀티스텝 작업에서 내부 목표 트래킹. |

**reasoning summary와 align/think 블록의 관계:**
codex의 `model_reasoning_summary = "auto"`는 모델이 자체 생성하는 추출본으로 응답 본문에 별도 노출되지 않는다 (`codex.ts` `extractItemText`가 text 채널만 추출). claw가 요구하는 `## 🤔 align` / `## 💬 think`은 사용자 향한 사고 노출이며 prompt.ts에서 명시 지시한 포맷대로 출력한다 (codex 내부 reasoning과 충돌하지 않음).

---

## Skills 시스템

### 개요

claw는 자체 skill 감지·주입 시스템을 갖는다. 유저 메시지가 들어오면 Haiku가 적합한 skill을 감지하고, 해당 skill의 내용을 메인 LLM 호출 시 systemAppend에 자동 주입한다.

### 디렉토리 구조

```
claw/
└── skills/
    └── {skill-name}/
        └── SKILL.md      # 필수. frontmatter에 name, description, triggers 포함
```

### SKILL.md 포맷

```markdown
---
name: skill-name
description: 한 줄 설명 (Haiku 분류기가 skill 선택 시 사용)
triggers:
  - 트리거 키워드/패턴 예시 1
  - 트리거 키워드/패턴 예시 2
---

# (skill 본문 — 메인 LLM systemAppend에 주입되는 실제 내용)
```

### Claw skill vs Repo skill 구분 원칙

| 기준 | Claw skill | Repo (codex) skill |
|------|-----------|--------------------------|
| 저장 위치 | `claw/skills/` | `{repo}/.codex/skills/` 또는 `{repo}/.claude/skills/` (codex가 cwd에서 자동 검색) |
| 주입 주체 | claw 오케스트레이터 (세션 시작 전) | codex 에이전트 (세션 도중) |
| 대상 | 인터랙션 패턴 / 커뮤니케이션 방식 | 코드베이스 내 구현 패턴 |
| 핵심 질문 | "레포가 달라져도 이 지식이 필요한가?" | "이 레포 코드를 알아야 쓸 수 있는가?" |

**Claw skill에 속하는 것:**
- 커뮤니케이션 (B2B 이메일 초안, 캘린더 미팅 협의)
- claw 시스템 자체 지식 (디버그, 재시작 패턴, 아키텍처)
- 레포에 무관하게 반복되는 크로스커팅 인터랙션 패턴

**Repo skill에 속하는 것:**
- 레포 내 코드 생성/수정 패턴 (API 추가, DB 쿼리 등)
- 레포 전용 CLI/스크립트 사용법
- 해당 레포 코드베이스 지식 없이는 쓸 수 없는 것

**중복 시:** repo skill로 단일화. claw skill은 repo skill 호출을 유도하는 힌트만 제공.

### "이건 claw skill로 추가해두자" 명령 처리

유저가 위 표현으로 명령하면:
1. `skills/{적절한-이름}/SKILL.md` 파일 생성
2. frontmatter에 name, description, triggers 작성
3. 본문에 주입할 실제 지침 내용 작성
4. git commit & push (소스 변경 아니므로 `pnpm build` 불필요, 재시작 마커 불필요)

### Skill 개선 논의 진입 전 확인 원칙

유저가 "스킬 개선하자", "갭 분석해줘", "이 스킬 손봐야 할 것 같아" 등 스킬 개선 요청을 하면, **갭 분석 전에 반드시 아래 두 가지를 먼저 확인한다.**

1. **사용 시나리오** — 이 스킬을 언제, 어떤 상황에서 쓸 예정인가?
2. **기대 산출물** — 한 번 쓰고 나면 손에 뭘 쥐고 있어야 하는가?

두 가지를 확인한 후에 분석 및 개선안 제안에 진입한다.
목적·기대결과가 명확하지 않은 상태에서 갭 분석을 시작하면 구현 도중 목적이 재정의되어 작업을 두 번 하게 된다.

---

### Skill 작성 검증 원칙

**스크립트·외부 라이브러리가 포함된 skill은 실행 검증 전 SKILL.md 초안 작성 금지.**

순서:
1. 실제 환경(Windows + pwsh 7.6.x)에서 설치·실행 테스트
2. 정확한 명령어·경로 확인 (절대경로 `C:\...` 기준)
3. 확인된 내용으로 SKILL.md 작성

이유: 검증 전 선작성 시 설치 명령어·경로가 틀려 SKILL.md를 이중 수정하게 됨.

---

## Git / GitHub — Windows LocalSystem 환경

- **HTTPS 고정**: `git remote set-url origin https://github.com/<owner>/<repo>` (SSH push 불가)
- **인증 setup (idempotent)**: `gh auth setup-git` — 여러 번 실행해도 안전. `$env:GH_TOKEN` 자동 인식.
- **push 스크립트**: `scripts/git-push.ps1 -Rebase` (pull --rebase → push)
- **금지**: `-f` 강제 push, `--no-verify`, `--no-gpg-sign` (사용자 명시 요청 시에만)

---

## Discord 응답 포맷 — 모바일 맞춤

claw는 Discord 진입점이며 **모바일 화면 가독성**이 최우선이다.
모든 응답은 아래 3개 섹션을 **이 순서·이 포맷 그대로** 출력한 뒤, 마지막에 실제 답변을 잇는다.

```
## 🔧 tools

- skill: <사용한 claw skill 이름들, 없으면 "(없음)">
- tools: <사용한 외부 도구 — codex web_search, gh, node_repl, MCP 등. 없으면 "(없음)">

## 🤔 align

` ` `
(코드블럭 안. 요청을 어떻게 이해했는지 자연어 5줄 내외.
 필요하면 ASCII diagram box 사용 — 모바일 폭 기준 ~30자 이내.)
` ` `

## 💬 think

` ` `
(코드블럭 안. 판단·라우팅·실행 흐름 자연어 5줄 내외.
 필요하면 ASCII diagram box. 모바일에서 한 줄이 잘리지 않게 폭 ~30자 이내.)
` ` `

(이후 실제 답변 — 결론·실행 결과·다음 단계 중심으로 간결히)
```

**Discord 렌더링 기준:**
- 헤딩(`##`)은 코드블럭 **밖** → Discord가 굵은 헤딩으로 렌더링
- align/think 본문은 코드블럭 **안** → 모바일에서 고정폭으로 일관 표시
- 위 예시의 `` ` ` ` `` 표기는 실제로는 backtick 3개 (마크다운 충돌 회피를 위해 공백 삽입한 것)

**작성 규칙:**
- tools 섹션은 bullet 2줄 고정 (`skill:` / `tools:`). 빈 경우 `(없음)`이라도 명시.
- align: 사용자 요청에서 파악한 것·맥락·라우팅 판단 근거를 자연어 5줄 내외.
- think: 처리 방식·advisor 위임 여부·주요 판단 포인트를 자연어 5줄 내외.
- 코드블럭 안 텍스트는 **줄당 ~30자**를 넘기지 않게 줄바꿈 (모바일 가로폭 가독성).
- ASCII diagram이 도움이 될 때만 삽입. 박스 폭도 ~30자 이내.
- 실제 답변은 핵심부터 먼저 (2000자 초과 시 claw가 자동 분할).
