# codex CLI 공식 spec (SSOT)

> 출처: 로컬 codex CLI `--help` 출력 + `~/.codex/config.toml` 실측.
> 확인일: 2026-05-26
> 버전: **codex-cli 0.133.0-alpha.1**
> 위치: `C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin\3f4fb8cdd344abc7\codex.exe` (해시 경로는 업데이트 시 변경)

이 문서가 `claw/src/codex.ts` `buildArgs`의 정본이다. **claw 코드는 이 spec과 1:1 매핑되어야 한다.** 추측 patch 금지.

---

## 1. 명령 구조

```
codex exec [OPTIONS] [PROMPT]             # 새 세션
codex exec [OPTIONS] <COMMAND> [ARGS]
  COMMAND = resume | review | help
codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]   # 세션 재개
```

**중요**: `exec` 와 `exec resume`은 **옵션 집합이 다르다.** 같다고 가정하면 깨진다.

---

## 2. `codex exec` 옵션 (새 세션) — 전체

| 옵션 | 값/플래그 | 비고 |
|---|---|---|
| `-c, --config <key=value>` | 키=값 | `~/.codex/config.toml` 오버라이드 |
| `--enable <FEATURE>` | feature | `-c features.<name>=true` 와 동등 |
| `--disable <FEATURE>` | feature | `-c features.<name>=false` 와 동등 |
| `--strict-config` | flag | 인식 안 되는 필드 시 에러 |
| `-i, --image <FILE>...` | 파일 경로 | 이미지 첨부 |
| `-m, --model <MODEL>` | 모델명 | config의 model 오버라이드 |
| `--oss` | flag | 오픈소스 provider 사용 |
| `--local-provider <OSS_PROVIDER>` | lmstudio\|ollama | `--oss` 와 함께 사용 |
| `-p, --profile <CONFIG_PROFILE>` | profile명 | config.toml의 `[profiles.X]` |
| `--profile-v2 <CONFIG_PROFILE_V2>` | profile명 | `$CODEX_HOME/<name>.config.toml` overlay |
| `-s, --sandbox <SANDBOX_MODE>` | **read-only \| workspace-write \| danger-full-access** | 모델 생성 셸 명령 sandbox 정책 |
| `--dangerously-bypass-approvals-and-sandbox` | flag | 승인·샌드박스 모두 우회 (외부 sandbox 필수) |
| `--dangerously-bypass-hook-trust` | flag | hook trust 우회 |
| `-C, --cd <DIR>` | 경로 | 작업 루트 지정 |
| `--add-dir <DIR>` | 경로 | 추가 쓰기 가능 디렉토리 |
| `--skip-git-repo-check` | flag | git repo 밖 실행 허용 |
| `--ephemeral` | flag | 세션 파일 디스크 저장 안 함 |
| `--ignore-user-config` | flag | `$CODEX_HOME/config.toml` 무시 (auth는 유지) |
| `--ignore-rules` | flag | `.rules` 무시 |
| `--output-schema <FILE>` | 경로 | 응답 JSON Schema |
| `--color <COLOR>` | always\|never\|auto | (기본 auto) |
| `--json` | flag | JSONL 이벤트 출력 |
| `-o, --output-last-message <FILE>` | 경로 | 마지막 메시지 파일 저장 |
| `-h, --help` | flag | |
| `-V, --version` | flag | |

PROMPT는 위치 인자 (마지막). `-`이면 stdin에서 읽음.

---

## 3. `codex exec resume` 옵션 — 전체

`exec`보다 옵션이 **적다.** 아래에 없는 옵션은 resume에서 사용 불가.

| 옵션 | 값/플래그 | 비고 |
|---|---|---|
| `-c, --config <key=value>` | 키=값 | |
| `--last` | flag | id 없이 가장 최근 세션 재개 |
| `--all` | flag | 모든 세션 표시 (cwd 필터 해제) |
| `--enable <FEATURE>` | feature | |
| `--disable <FEATURE>` | feature | |
| `-i, --image <FILE>` | 파일 경로 | |
| `--strict-config` | flag | |
| `-m, --model <MODEL>` | 모델명 | |
| `--dangerously-bypass-approvals-and-sandbox` | flag | |
| `--dangerously-bypass-hook-trust` | flag | |
| `--skip-git-repo-check` | flag | |
| `--ephemeral` | flag | |
| `--ignore-user-config` | flag | |
| `--ignore-rules` | flag | |
| `--output-schema <FILE>` | 경로 | |
| `--json` | flag | |
| `-o, --output-last-message <FILE>` | 경로 | |
| `-h, --help` | flag | |

### resume에 **없는** 옵션 (`exec`에는 있지만 resume에서는 거부됨)

- `-s, --sandbox` ← **이걸 추가하면 exit code 2 발생**
- `--oss`, `--local-provider`
- `-p, --profile`, `--profile-v2`
- `-C, --cd`, `--add-dir`
- `--color`
- `-V, --version`

위치 인자 순서: `[SESSION_ID] [PROMPT]`. SESSION_ID는 UUID 또는 thread name. 옵션은 SESSION_ID/PROMPT의 앞·뒤 어디든 가능 (clap 일반 동작).

---

## 4. JSONL 이벤트 스키마 (실측 1회)

`codex exec --json -` 호출 시 stdout에 한 줄당 하나의 JSON 객체. 실측한 이벤트 타입:

```json
{"type":"thread.started","thread_id":"019e649c-bae5-7583-b04a-e11aa5c99ae5"}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"..."}}
{"type":"turn.completed","usage":{"input_tokens":30612,"cached_input_tokens":2432,"output_tokens":111,"reasoning_output_tokens":0}}
```

### claw가 사용하는 필드 매핑

| claw 코드 (`codex.ts`) | spec 필드 |
|---|---|
| `event.type === 'session_meta'`, `event.payload?.id` | **이 버전에는 없음** — `thread.started`의 `thread_id` 사용 필요 |
| `event.type === 'session_summary'`, `event.session_id` | **이 버전에는 없음** |
| `event.type === 'item.completed'`, `event.item.type === 'agent_message'` (text) | 일치 ✓ |
| `event.item.item_type` | 이 버전에서는 `item.type` 사용 — claw 코드의 `item_type ?? item.type ?? ''` fallback이 잘 작동 ✓ |

**핵심 격차**: claw `codex.ts`의 `consumeEvent`가 `session_meta`/`session_summary`만 보고 `acc.sessionId`를 설정하는데, **현재 codex CLI는 `thread.started`로 출력**한다. 그래서 acc.sessionId가 항상 빈 문자열이 되어 `lookupLatestCodexSessionId` fallback이 매번 호출되고, fallback도 LocalSystem 환경에서 실패한다.

### 해결: thread.started 처리 추가

`consumeEvent`에 다음 분기 추가 필요:
```typescript
} else if (event.type === 'thread.started') {
  const tid = (event as { thread_id?: string }).thread_id;
  if (tid) acc.sessionId = tid;
}
```

---

## 5. claw `buildArgs` 정합 매핑 (정본)

```typescript
function buildArgs(opts: CodexRunOptions): string[] {
  // exec vs exec resume — 옵션 집합이 다름. SSOT: claw/docs/codex-cli-spec.md
  const args: string[] = ['exec'];

  if (opts.resume) {
    // resume subcommand: positional SESSION_ID + PROMPT.
    // resume은 --sandbox/-s, --cd/-C 등 받지 않음. 추가 시 exit 2.
    args.push('resume', opts.resume);
    args.push('--json');
    if (opts.model) args.push('--model', opts.model);
  } else {
    // 새 세션
    args.push('--json', '--sandbox', 'danger-full-access');
    if (opts.model) args.push('--model', opts.model);
  }

  args.push('-');  // PROMPT는 stdin
  return args;
}
```

### resume에서 sandbox는 어떻게 처리되나?

resume은 원래 세션의 sandbox 정책을 그대로 이어받는다. resume에서 sandbox를 바꾸고 싶으면 `-c sandbox_mode="danger-full-access"` 같이 `-c` 오버라이드로 가능 — 단, 그것도 옵션이라 claw에서는 새 세션의 sandbox를 신뢰하는 것으로 충분.

---

## 6. 환경변수

| 변수 | 역할 |
|---|---|
| `CODEX_HOME` | `~/.codex` 위치 오버라이드. NSSM LocalSystem 환경에서는 **반드시** `C:\Users\yeoul\.codex`로 설정해야 auth/sessions 파일 접근 가능 |
| `CODEX_BIN` | claw가 spawn할 codex 바이너리 경로. npm wrapper(`codex.ps1`) 대신 직접 exe 경로 (`...\codex.exe`) 권장 — `spawn` shell 없이 실행 가능 |

---

## 7. 알려진 노이즈 / 사이드 이슈

- **`~/.agents/skills/<name>/SKILL.md` frontmatter 누락 시 stderr 경고**: codex가 시작 시 사용자 글로벌 skill 로딩 실패 경고 출력. 응답 자체에는 영향 없지만 stderr 노이즈. 예: `C:\Users\yeoul\.agents\skills\google-workspace\SKILL.md`. frontmatter 추가하거나 파일 제거로 해결.
- **resume 사용 시 cwd**: resume은 원래 세션의 cwd를 따른다. claw가 spawn에 `cwd: opts.cwd`를 주더라도 resume 세션은 원본 cwd로 돌아갈 수 있음. cwd 강제하려면 `-c` 오버라이드 또는 새 세션 사용.

---

## 8. 변경 감지 체크리스트 (codex CLI 업데이트 시)

codex CLI 업데이트 시 이 문서 갱신 + claw 호환성 점검:

1. `codex --version` — 메이저 버전 변경
2. `codex exec --help` diff
3. `codex exec resume --help` diff
4. `codex exec --json -` 출력 (이벤트 스키마 diff)
5. claw `codex.ts` 의 `buildArgs`, `consumeEvent`, `extractItemText` 점검
6. 통합 테스트: 새 세션 + thread 내 resume 2가지 시나리오

---

## 9. 검증 명령 (post-change)

claw 코드 수정 후 항상 다음 순서로 검증:

```powershell
# (1) 빌드
Set-Location C:\yeojin-context-hub\claw; pnpm build

# (2) 재시작
Restart-Service claw    # 관리자 PS

# (3) 3-way 진단
Get-Item C:\yeojin-context-hub\claw\dist\codex.js | Select-Object LastWriteTime
Get-Content (nssm get claw AppStderr) -Tail 10
Get-Content (nssm get claw AppStdout) -Tail 20 | Select-String "commit|claw gateway starting|codex run|codex exited"

# (4) Discord 발화 — 1회 (새 세션)
# (5) 같은 thread 안 2회 (resume)
# 양쪽 모두 'codex run ok' 로그 + 정상 Discord 응답이어야 PASS
```
