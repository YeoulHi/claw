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

# Claw 디버깅 지침 (요약)

**환경:** Windows 11 (DUWLS) / Node v24 / PowerShell 7.6.x / codex(GPT-5.5) 엔진 / NSSM 서비스 supervisor.
macOS `launchctl` / `lsof` / `kill -9` 흐름은 사용하지 않는다 — 트리거에 등장하더라도 NSSM·pwsh 명령으로 즉시 매핑한다.

**정본 문서:** [`claw/OPS.md`](../../OPS.md) — 운영 절차·에러 표·검증된 경로는 여기서 본다.
**환경 매핑 SSOT:** [`claw/docs/gpt55-windows-mapping.md`](../../docs/gpt55-windows-mapping.md)

## 빠른 의사결정

| 상황 | 1순위 액션 |
|------|-----------|
| 코드 변경 → 반영 필요 | `pnpm build` → Discord `#claw`에 재시작 유도 또는 관리자 pwsh에서 `Restart-Service claw` |
| `EADDRINUSE :::3200` | NSSM `claw` 서비스 가동 중. PID kill 시도 전에 Discord 재시작 또는 `Restart-Service claw` (관리자 pwsh) |
| `Access is denied` / `액세스가 거부되었습니다` | NSSM `LocalSystem` 권한 — 사용자 PID kill 불가, `Restart-Service claw` 또는 Discord 재시작으로 우회 |
| Discord 응답 없음 | NSSM 로그(`nssm get claw AppStdout` / `AppStderr` 경로) + `data/claw.db`의 `message_queue` 확인 |
| 빈 메시지 송신 | `__CLAW_RESTART__` 단독 출력 — 마커 앞에 사람이 읽을 텍스트 한 줄 필수 |
| 포트 점유 확인 | `Get-NetTCPConnection -LocalPort 3200` 또는 `netstat -ano | findstr ":3200"` (bash `lsof` 금지) |
| 프로세스 강제 종료 | `Stop-Process -Id <PID> -Force` 또는 `taskkill /PID <PID> /F` (bash `kill -9` 금지) |

## 아키텍처 핵심

- claw = Discord 봇 + 오케스트레이터(codex(GPT-5.5) CLI를 `--sandbox danger-full-access`로 spawn). Gateway / Worker 분리.
- 재시작: 응답에 `__CLAW_RESTART__` 마커 → claw가 제거 후 `process.exit(0)` → NSSM이 자동 재기동. 자세한 경로는 `OPS.md` 참조.
- 메시지 큐: 재시작 중 수신 메시지는 SQLite `message_queue` 보관 → 재시작 후 자동 처리.
- 뮤텍스: thread별 `runWithMutex()` — 동일 thread 동시 실행 방지.
- 세션 추적: SQLite `sessions` — `thread_id` → codex session id 매핑.

## 디버깅 절차

1. 최근 이벤트: `data/claw.db` → `SELECT * FROM events ORDER BY ts DESC LIMIT 20;`
2. 최근 로그: `logs/` 디렉토리 + NSSM stdout/stderr 경로 (`nssm get claw AppStdout`)
3. 서비스 상태: `Get-Service claw | Select-Object Status, StartType`
4. 재현 가능하면 `__tests__/` 아래 단위 테스트 추가
5. 수정 후 `pnpm build` → 응답에 재시작 마커 포함 (관리자 pwsh가 있으면 `Restart-Service claw`로 즉시 반영도 가능)

## 소스 변경 시 필수

- 빌드: `pnpm build` (tsc → `src/` → `dist/`. `dist/` 직접 편집 금지)
- 재시작: 응답에 `__CLAW_RESTART__` (앞에 사람 읽을 텍스트 한 줄 필수) 또는 `Restart-Service claw`
- Git 푸시: HTTPS remote 고정 (`https://github.com/<owner>/<repo>`), `gh auth setup-git` 한 번 실행으로 `$env:GH_TOKEN` 자동 인식
- 자세한 절차·에러 대응: `OPS.md`
