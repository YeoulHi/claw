# 소스 변경 → 빌드 → 재시작 → 진단 → 실측 사이클

claw 소스를 수정한 뒤 **실측 통과**까지 가는 표준 사이클. 어휘 grep PASS는 cycle 종료 조건이 아니다.

---

## 사건 ↔ 조항 매핑 (eval 기준)

| 사건 | 증상 | 커버 조항 |
|---|---|---|
| **사건 8** — 빌드 후 서비스 재시작 안 됐는데 "왜 안 되지" 반복. dist 시각 vs node 프로세스 시작 시각 3-way 진단 부재 | "재시작 해주세요" 추측 루프 | §1 단계 2·3·4, §2 3-way 진단 표, §4 반례 1 |
| **사건 9** — 어휘 grep PASS 자기 선언 → 실측 안 함 → 실제로는 깨진 상태 | "PASS 했으니 끝" 오판 | §3 실측 통과 기준, §4 반례 2 |

---

## 1. 사이클 단계 5개

소스 한 줄이라도 바꿨으면 **전 단계를 순서대로** 돌린다. 중간 생략 금지.

### 1단계 — 빌드
```powershell
Set-Location C:\yeojin-context-hub\claw
pnpm build
```
빌드 실패 시 여기서 중단. 다음 단계 진행 금지.

### 2단계 — dist 시각 확인 (빌드 산출물 검증)
```powershell
Get-Item C:\yeojin-context-hub\claw\dist\codex.js | Select-Object LastWriteTime
```
방금 시각이 찍혔는지 눈으로 확인. 시각이 과거면 빌드 실패한 것 — 1단계로 복귀.

### 3단계 — 서비스 재시작 (관리자 PowerShell)
```powershell
Restart-Service claw
```
권한 오류면 관리자 권한 PS로 재실행. 사용자에게 "재시작 해주세요"라고 던지기 **전에** 4단계 진단부터 시도한다.

### 4단계 — 3-way 진단
§2 표 참조. dist 시각 / 서비스 PID·State / stderr 세 축을 동시에 본다.

### 5단계 — 실측
§3 기준 충족까지 cycle은 끝나지 않는다.

---

## 2. 3-way 진단 — 무엇을 잡는가

```powershell
Get-Item C:\yeojin-context-hub\claw\dist\codex.js | Select-Object LastWriteTime                                    # A. 빌드 시각
Get-WmiObject Win32_Service -Filter "Name='claw'" | Select-Object ProcessId, State      # B. 서비스 상태·PID
Get-Content (nssm get claw AppStderr) -Tail 10                                          # C. 최근 stderr
```

선택 시 PID로 프로세스 시작 시각도 확인:
```powershell
Get-Process -Id (Get-WmiObject Win32_Service -Filter "Name='claw'").ProcessId | Select-Object StartTime
```

| 관측 | 의미 | 조치 |
|---|---|---|
| A(dist 시각) > B(프로세스 StartTime) | 빌드는 됐는데 재시작 안 됨 | `Restart-Service claw` |
| C stderr에 `EADDRINUSE` | 이전 worker 잔존 | `Stop-Service claw; Get-Process node \| Stop-Process -Force; Start-Service claw` |
| C stdout/stderr에 `exit code N` | codex 인자/환경 문제 | `docs/codex-cli-spec.md` 인자 재확인 → 1단계 복귀 |
| B State ≠ `Running` | 서비스 자체 죽음 | C stderr → 원인별 분기 |
| A 시각이 과거 | pnpm build 실패 또는 미실행 | 1단계 재실행 |

---

## 3. 실측 통과 기준 (어휘 grep ≠ eval)

`docs/gpt55-windows-eval-rubric.md`의 어휘 채점은 **보조 도구**다. 어휘 일치는 "기대 단어가 prompt나 응답에 들어 있다"를 확인할 뿐, 실제 동작 검증이 아니다.

**cycle PASS 조건** — 다음 둘 중 하나가 충족돼야 한다:

1. **Discord 발화 실측** — Discord 채널에 발화 → claw가 정상 응답하고, **새 지침 어휘가 응답 본문에 반영**돼 있다. 두 조건 동시 충족.
2. **직접 명령 dry-run** — `codex exec --json -` 등 변경한 코드 경로를 직접 호출해 종료 코드 0 + 기대 출력 확인.

다음은 PASS 아님:
- `rg "기대단어" src/` 가 hit한 것
- `pnpm build` 가 성공한 것
- `Restart-Service claw` 가 오류 없이 끝난 것

이 셋은 모두 **선행 조건**일 뿐, cycle 종료 신호가 아니다.

---

## 4. 반례 — 추측 patch loop 패턴

오늘 세션에서 발생한 실패 패턴. 이렇게 하면 안 된다.

### 반례 1 — dist 시각 확인 없이 "재시작 해주세요" 반복
**증상**: 빌드는 했는데 서비스가 묵은 코드로 돌고 있는지 새 코드로 돌고 있는지 모름. 그 상태에서 사용자에게 "재시작 해주세요"만 반복. 사용자가 재시작했다고 답해도 dist 시각 < 프로세스 StartTime을 확인 안 함 → 실제로는 재시작 실패였음.
**대신**: §2 3-way 진단을 **agent가 직접** 돌린다. A vs B 시각 비교 없이 "재시작 됐겠지" 추측 금지.

### 반례 2 — 어휘 grep PASS만 보고 실측 생략
**증상**: `rg "<새 지침 키워드>" src/` 가 hit. "PASS"라고 자기 선언 → 사용자에게 "완료" 보고 → 실제로는 빌드 안 됐거나 서비스가 옛 코드로 응답 중. Discord 실측 시 깨진 응답.
**대신**: 어휘 grep은 §3의 1·2번 실측 **이후**에만 보조 지표로 본다. cycle 종료 선언은 §3 PASS 후에만.

### 반례 3 — codex --help 안 보고 argv 추측
**증상**: codex 인자가 안 먹는데 `-x`, `--xxx` 등을 추측으로 넣고 빌드·재시작 반복.
**대신**: `codex --help` / `docs/codex-cli-spec.md` 먼저 본 뒤 1단계 진입.

---

## 5. 명령어 묶음 (복사용)

> **경로 원칙**: 모든 path는 절대경로 사용. 상대경로(`dist/...`)는 호출자 CWD에 종속돼 빈 출력 또는 오작동을 낸다 (외부 셸·관리자 PS·sub-agent 환경에서 다름).

```powershell
# === 1·2단계: 빌드 + dist 시각 ===
Set-Location C:\yeojin-context-hub\claw
pnpm build
Get-Item C:\yeojin-context-hub\claw\dist\codex.js | Select-Object LastWriteTime

# === 3단계: 재시작 (관리자 PS) ===
Restart-Service claw

# === 4단계: 3-way 진단 ===
Get-Item C:\yeojin-context-hub\claw\dist\codex.js | Select-Object LastWriteTime
Get-WmiObject Win32_Service -Filter "Name='claw'" | Select-Object ProcessId, State
Get-Process -Id (Get-WmiObject Win32_Service -Filter "Name='claw'").ProcessId | Select-Object StartTime
Get-Content (nssm get claw AppStderr) -Tail 10

# === EADDRINUSE 복구 ===
Stop-Service claw
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Service claw

# === 5단계: 직접 명령 실측 (Discord 실측이 어려울 때) ===
# codex stdin은 평문 prompt를 받음 (--json은 출력 형식 옵션).
# CODEX_HOME / CODEX_BIN 환경변수가 현재 셸에 설정돼 있어야 NSSM 환경을 재현.
$env:CODEX_HOME = "C:\Users\yeoul\.codex"
"테스트" | & "$env:CODEX_BIN" exec --json --sandbox danger-full-access - 2>&1 | Select-Object -First 20
```

---

## 참조

- `claw/docs/gpt55-windows-eval-rubric.md` — 어휘 채점 루브릭. **보조 도구**이며 cycle 종료 신호가 아니다 (§3 참조).
- `claw/docs/codex-cli-spec.md` — codex 인자·환경변수 정본. 반례 3 방지.
- `claw/OPS.md` — 빌드·재시작 정본. 본 SOP는 OPS.md의 운영 절차를 "실측까지" 확장한 것.
