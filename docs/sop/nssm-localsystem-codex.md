# NSSM LocalSystem 환경 codex 운용 SOP

NSSM 서비스 `claw` 가 `LocalSystem` 권한으로 codex CLI(`gpt-5.5`)를 spawn 할 때 반복적으로 깨지는
환경 이슈에 대한 정본. 본 문서의 조항을 따랐다면 오늘(2026-05-26) 발생한 사건 1·2·3·6은 사전에
차단됐어야 한다. 새 사건이 검증되면 매핑 표에 행을 추가한다.

---

## 사건 ↔ 조항 매핑 (eval 기준)

| 사건 | 요약 | cover 조항 |
|---|---|---|
| 1 | NSSM LocalSystem이 `C:\Users\yeoul\.codex\auth.json` 을 못 읽음 | §2 CODEX_HOME 설정 필수 |
| 2 | `codex.ps1` (npm wrapper)을 Node `spawn`이 실행 못 함 | §3 CODEX_BIN 직접 exe 경로 |
| 3 | `ObjectName` 을 `.\yeoul`로 바꾸려다 패스워드 실패 → 서비스 다운 | §4 NSSM 계정 변경 5분 룰 |
| 6 | `lookupLatestCodexSessionId` 의 `os.homedir()` 가 `systemprofile` 로 평가 | §2 CODEX_HOME 설정 필수 (코드는 패치 완료) |

---

## 0. 사전 사실 (참조)

본 SOP는 아래 SSOT를 중복 작성하지 않는다. 경로·argv·운영 명령은 원본을 본다.

- 경로·매핑 SSOT: [`claw/docs/gpt55-windows-mapping.md`](../gpt55-windows-mapping.md)
- codex CLI argv 스펙: [`claw/docs/codex-cli-spec.md`](../codex-cli-spec.md)
- 운영 정본 (재시작·포트·NSSM 기본): [`claw/OPS.md`](../../OPS.md)

---

## 1. NSSM LocalSystem이 사용자 홈 파일에 접근 못 하는 이유

NSSM 서비스 `claw` 의 `StartName` 은 `LocalSystem` 이다 (`OPS.md` 환경 표 참조).
LocalSystem 계정은 `C:\Users\yeoul` 가 아니라 `C:\Windows\System32\config\systemprofile` 을
`USERPROFILE` 로 본다. 따라서:

- `os.homedir()` / `process.env.USERPROFILE` → `C:\Windows\System32\config\systemprofile`
- `~/.codex/auth.json` 같은 사용자 홈 의존 경로는 **존재하지 않는 파일**을 가리킨다.
- codex CLI는 인증 정보를 못 찾아 즉시 종료하거나, claw 측 `lookupLatestCodexSessionId` 가
  세션 파일을 못 찾아 빈 결과를 반환한다 (사건 6).

해결 원칙: **사용자 홈에 의존하지 말고 환경변수로 절대경로를 강제한다.**

---

## 2. CODEX_HOME 설정 필수 (사건 1·6 cover)

claw 서비스 환경변수에 `CODEX_HOME` 을 박아 codex CLI와 `claw/src/codex.ts`
양쪽이 동일한 위치를 보도록 한다.

### 2.1 현재 값 조회 (dry-run, 관리자 PS 불필요)

```powershell
nssm get claw AppEnvironmentExtra
```

### 2.2 값 설정 (관리자 PS 필수)

여러 env를 한 번에 설정할 때는 백틱 개행으로 줄을 분리한다. `nssm set` 은 기존 값을
**덮어쓰므로**, 현재 값을 먼저 조회한 후 합쳐서 다시 set 한다.

```powershell
nssm set claw AppEnvironmentExtra "CODEX_HOME=C:\Users\yeoul\.codex`nCODEX_BIN=C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin\<hash>\codex.exe"
```

- `<hash>` 는 실제 설치된 codex 버전 디렉토리명으로 치환한다 (§3 참조).
- 백틱(`` ` ``) + `n` 은 PowerShell 문자열 안의 줄바꿈 — `nssm` 이 멀티라인 env를
  파싱하는 표준 방식이다.

### 2.3 적용 (관리자 PS 필수)

```powershell
Restart-Service claw
```

### 2.4 검증

서비스 기동 후 NSSM 로그(`OPS.md`의 "NSSM 로그" 항목으로 경로 확인) stdout에서
codex 호출이 `auth.json not found` 없이 통과하는지 확인한다.

> 사건 6 관련: `claw/src/codex.ts` 의 `lookupLatestCodexSessionId` 는 이미
> `process.env.CODEX_HOME` 우선, fallback `os.homedir()` 순서로 패치됐다.
> CODEX_HOME 이 비어 있으면 fallback이 `systemprofile` 로 가서 또 깨진다 — 이 조항이
> 안 지켜지면 코드 패치만으로 해결 안 된다.

---

## 3. CODEX_BIN 직접 exe 경로 지정 (사건 2 cover)

`C:\Users\yeoul\AppData\Roaming\npm\codex.ps1` 는 PowerShell wrapper 스크립트다.
Node.js `child_process.spawn` 은 `.ps1` 을 **직접 실행할 수 없다** (Windows의 PATHEXT는
`cmd.exe` 셸 검색일 뿐이고, `spawn` 의 기본 동작 `shell: false` 에서는 무시된다).

따라서 codex CLI를 spawn 하는 코드(`claw/src/codex.ts`)는 환경변수 `CODEX_BIN` 으로
실제 `.exe` 절대경로를 받아야 한다.

### 3.1 실제 exe 경로 찾기 (dry-run)

```powershell
Get-ChildItem "C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin" -Directory |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 -ExpandProperty FullName
```

위 결과 디렉토리 아래 `codex.exe` 가 최종 경로다. 예:
`C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin\<hash>\codex.exe`

### 3.2 NSSM 서비스에 등록 (관리자 PS 필수)

§2.2 의 `AppEnvironmentExtra` set 명령에 `CODEX_BIN=...` 행을 함께 포함시킨다.
별도로 분리해서 두 번 set 하면 두 번째가 첫 번째를 덮어쓴다.

### 3.3 검증

```powershell
nssm get claw AppEnvironmentExtra
```

출력에 `CODEX_BIN=C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin\...\codex.exe` 가 포함되고,
해당 경로가 실재(`Test-Path`)하는지 확인한다.

```powershell
Test-Path "C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin\<hash>\codex.exe"
```

> codex 업데이트가 발생하면 `<hash>` 디렉토리명이 바뀐다. 업데이트 직후
> claw 응답이 깨지면 §3.1을 다시 돌려 최신 경로로 `CODEX_BIN` 을 갱신한다.

---

## 4. NSSM 계정 변경 5분 룰 (사건 3 cover)

`ObjectName` 을 `LocalSystem` 외 사용자 계정(예: `.\yeoul`)으로 바꾸는 시도는 **반드시 사전 검증**을 거쳐야 한다. 패스워드가 한 글자라도 틀리면 NSSM은 서비스를 기동조차 못 시키고, 그 사이 claw 전체가 다운된다.

### 4.1 사전 검증 (dry-run, 관리자 PS 필수)

계정·패스워드 조합이 실제로 로그온 가능한지 별도 컨텍스트에서 확인한다.

```powershell
# 현재 계정 조회
nssm get claw ObjectName

# 대상 계정의 로그온 권한 검증 — runas로 빈 명령 실행해서 패스워드 검사
runas /user:.\yeoul "cmd /c exit"
```

`runas` 가 성공해야만 §4.2 로 진행한다.

### 4.2 계정 변경 (관리자 PS 필수)

```powershell
nssm set claw ObjectName ".\yeoul" "<password>"
Restart-Service claw
```

### 4.3 5분 룰 — 실패 시 즉시 복구

`Restart-Service claw` 후 **5분 안에** 서비스가 `Running` 으로 안 올라오면, 추가 디버깅을
시도하지 말고 즉시 LocalSystem으로 원복한다. 다운타임을 늘리지 않는다.

```powershell
# 상태 확인
Get-Service claw

# 즉시 복구 — LocalSystem 으로 원복 (패스워드 불필요)
nssm set claw ObjectName "LocalSystem"
Start-Service claw

# 복귀 후 상태 재확인
Get-Service claw
```

복구가 끝난 뒤에 별도 시간을 잡아 계정·권한 문제를 분석한다. 운영 중 디버깅 금지.

---

## 5. 검증 체크리스트 (dry-run)

배포·환경 변경 직후 아래 명령을 위에서 아래로 실행해 모든 결과가 기대값을 만족하는지 확인한다.
모든 명령은 dry-run 가능(상태 조회 + 명시적 set/restart만)하다.

```powershell
# 1) 서비스 가동 상태
Get-Service claw

# 2) NSSM 기본 설정
nssm get claw ObjectName            # 기대: LocalSystem
nssm get claw AppDirectory          # 기대: C:\yeojin-context-hub\claw
nssm get claw AppEnvironmentExtra   # 기대: CODEX_HOME=... / CODEX_BIN=...

# 3) codex 바이너리 실재 확인
Test-Path "C:\Users\yeoul\AppData\Local\OpenAI\Codex\bin\<hash>\codex.exe"

# 4) codex auth 파일 실재 확인
Test-Path "C:\Users\yeoul\.codex\auth.json"

# 5) 포트
Get-NetTCPConnection -LocalPort 3200 | Select-Object OwningProcess, State

# 6) (관리자 PS) 변경 반영
Restart-Service claw
```

이상 6단계가 모두 통과하면 §2·§3 조건이 충족된 상태다. §4 적용 중이라면
`ObjectName` 값만 의도한 계정(`.\yeoul` 등)으로 다를 수 있다 — 단, 5분 룰을 지킨다.
