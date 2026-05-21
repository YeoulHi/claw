# claw 운영 가이드 (Windows / DUWLS)

claw 운영 중 발생하는 문제 — 재시작, 포트 충돌, 빌드 반영 등 — 의 정본.
새 이슈가 검증되면 이 문서에 추가한다. (검증 전 추측 금지)

> Windows PowerShell 7.6.x 환경 특유 이슈(gh not found, 2>&1 redirect 등)는
> **[`notes/windows-ps76-issues.md`](./notes/windows-ps76-issues.md)** 에 누적 기록.

---

## 환경

- 호스트: 데스크탑 DUWLS (Windows 11 Home)
- 런타임: Node v24.12.0
- 셸: PowerShell 7+
- 대시보드 포트: 3200 (`DASHBOARD_PORT`)
- DB: `C:\yeojin-context-hub\claw\data\claw.db` (SQLite)
- 로그: `C:\yeojin-context-hub\claw\logs/`
- **프로세스 supervisor**: NSSM 서비스 (서비스명 `claw`, AppDirectory `C:\yeojin-context-hub\claw`, StartName `LocalSystem`). 부팅 시 자동 시작. 등록 절차는 `docs/sessions/2026-05-19.md`의 004-05d 섹션 참조.
- **NSSM 로그**: `logs/` 아래 stdout/stderr 리다이렉트 파일 (실제 파일명은 `nssm get claw AppStdout` / `AppStderr`로 확인)

---

## 시작 / 종료

### 시작 (콜드 부트)

NSSM 서비스가 등록되어 있어 부팅 시 자동 시작된다. 수동 기동·재기동이 필요할 때만:

```powershell
# 일반 운영 — NSSM 사용 (관리자 권한 PS 필요)
Restart-Service claw  # 관리자 권한 PS 필요

# NSSM이 없거나 디버그용 직접 실행
cd "C:\yeojin-context-hub\claw" && node dist/server.js
```

> NSSM 서비스가 이미 실행 중인데 터미널에서 `node dist/server.js`를 또 띄우면 포트 3200 충돌(EADDRINUSE) 발생. 이 경우 아래 "포트 충돌" 참조.

### 정상 종료

claw가 실행 중인 터미널에서 `Ctrl+C`. 다른 세션에서 PID 종료를 시도하면 권한 에러가 날 수 있음 (`Stop-Process: Access is denied`).

---

## 재시작

### 1순위: Discord #claw 채널 (권장)

#claw 채널에서 claw 봇에게 메시지:

```
재시작해줘
```

claw가 응답에 `__CLAW_RESTART__` 마커를 포함시키면 자동 재시작된다.
**이 경로가 가장 안정적.** 빌드된 `dist/`를 가져와 새 세션으로 시작됨이 2026-05-20 세션에서 검증됨.

> **Windows 재기동 메커니즘:** 마커 검출 → claw `process.exit(0)` → NSSM이 서비스 자동 재기동.
> NSSM이 supervisor 역할이라 사용자가 직접 PID 종료를 시도할 필요 없음.

### 2순위: 관리자 PS에서 서비스 재시작

```powershell
Restart-Service claw  # 관리자 권한 PS 필요
```

Discord 경로가 막혔거나 새 빌드를 강제 적용할 때.

### 3순위: 디버그 직접 실행

NSSM 서비스를 중지하고 터미널에서 직접 띄워 stdout 관찰:

```powershell
Stop-Service claw  # 관리자 권한 PS 필요
cd "C:\yeojin-context-hub\claw" && node dist/server.js
```

작업 끝나면 `Start-Service claw`(관리자 PS)로 NSSM 운영 복귀.

---

## 빌드 흐름

소스 변경 후:

```powershell
cd "C:\yeojin-context-hub\claw"
pnpm build
```

- `tsc`가 `src/` → `dist/` 컴파일.
- 빌드만으로는 실행 중인 claw에 반영 안 됨. **재시작 필요.**
- claw-maintenance 응답이 "재시작 불필요"라고 판단해도, `src/` 변경이 있었다면 실제로는 필요. 마커가 포함된 응답을 한 번 받아두는 게 안전.

---

## 포트 충돌 (EADDRINUSE :3200)

```
Error: listen EADDRINUSE: address already in use :::3200
```

기존 claw가 살아있다는 신호. 새 인스턴스를 띄울 수 없음.

### 진단

```powershell
netstat -ano | findstr ":3200"
# 또는 modern:
Get-NetTCPConnection -LocalPort 3200 | Select-Object OwningProcess, State
```

### 종료 시도

```powershell
Stop-Process -Id <PID> -Force
# 또는
taskkill /PID <PID> /F
```

**실패 시 (`Access is denied` / `액세스가 거부되었습니다`):**
- claw가 NSSM 서비스(LocalSystem 권한)로 실행 중이라 일반 권한·관리자 권한 모두 PID 직접 종료가 막힌다 (소유자·커맨드라인 조회도 비어있음).
- 이때는 PID 강제 종료를 시도하지 말고 **Discord 재시작 경로로 우회**하거나 `Restart-Service claw`(관리자 PS) 사용. 새 빌드는 자동 반영됨.

---

## 자주 만나는 에러

| 증상 | 원인 후보 | 처리 |
|------|-----------|------|
| `EADDRINUSE :::3200` | NSSM `claw` 서비스 가동 중 | Discord 재시작 또는 `Restart-Service claw` |
| `Access is denied` / `액세스가 거부되었습니다` (Stop-Process / taskkill) | NSSM LocalSystem 권한 프로세스 | PID kill 포기, `Restart-Service claw`(관리자 PS) 또는 Discord 재시작 |
| Discord 응답 안 옴 | claw 다운 또는 큐 적체 | NSSM 로그·`data/claw.db`의 `message_queue` 확인 |
| 빈 메시지가 Discord에 전송됨 | `__CLAW_RESTART__` 단독 출력 | 마커 앞에 사람 읽을 텍스트 한 줄 필수 |
| 재시작 후에도 옛 동작 | `pnpm build` 누락 | 빌드 후 재시작 |

---

## 알려진 노이즈 (Windows에서 무시 가능)

### `launchctl kickstart` 언급

`claw-maintenance` 세션 응답에 다음 같은 표현이 보일 수 있다:

> 마커는 claw가 검출해서 본문에서 제거 후 `launchctl kickstart -k gui/<uid>/com.claw`로 자동 재시작한다.

이 문구는 `src/orchestrator/prompt.ts:167`의 systemAppend가 macOS 기준으로 작성되어 있어 LLM이 그대로 반복하는 것일 뿐, **Windows에서는 무시.** 마커(`__CLAW_RESTART__`) 자체는 platform에 무관하게 동작한다.

> 근본 fix는 005 parking lot의 "`launchctl kickstart` 하드코딩 platform 추상화" 항목 — 향후 PR로 분리 진행.

### `.env`의 `DISCORD_CHANNEL_DIARY`

`claw/.env`에 있는 `DISCORD_CHANNEL_DIARY` 변수는 **코드에서 읽히지 않는 문서화 전용 변수**다. 실제 채널 ID SSOT는 `claw/claw.config.json`의 `repos[].channelId`.

## 변경이 반영되었는지 확인

1. 시작 로그의 `commit` 해시 (예: `claw gateway starting {"commit":"adaef79"}`) — 최신 HEAD와 일치하는지.
2. Discord #claw 채널에서 동작 테스트.
3. `data/claw.db`의 `events` 테이블에서 `claude.invoke` / `router.classify` 최신 행 확인.

---

## 관련 문서

- `claw/CLAUDE.md` — 작업 지침 (skill 시스템, 재시작 마커 규칙)
- `claw/skills/claw-debug/SKILL.md` — 디버깅 skill (트리거 키워드 + 본 문서 참조)
