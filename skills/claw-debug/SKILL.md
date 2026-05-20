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

**환경:** Windows / DUWLS / Node v24 / PowerShell. macOS `launchctl` 흐름 아님.

**정본 문서:** [`claw/OPS.md`](../../OPS.md) — 운영 절차·에러 표·검증된 경로는 여기서 본다.

## 빠른 의사결정

| 상황 | 1순위 액션 |
|------|-----------|
| 코드 변경 → 반영 필요 | `pnpm build` → Discord #claw 채널에서 재시작 유도 |
| `EADDRINUSE :::3200` | NSSM `claw` 서비스 가동 중. PID kill 시도하기 전에 Discord 재시작 또는 `Restart-Service claw`(관리자 PS) |
| `Access is denied` / `액세스가 거부되었습니다` | NSSM LocalSystem 권한 — PID kill 포기, `Restart-Service claw` 또는 Discord 재시작 |
| Discord 응답 없음 | 터미널 로그 + `data/claw.db` `message_queue` 확인 |
| 빈 메시지 송신 | `__CLAW_RESTART__` 단독 출력 — 앞에 사람 읽을 텍스트 필수 |

## 아키텍처 핵심

- claw = Discord 봇 + 오케스트레이터. Gateway / Worker 분리.
- 재시작: 응답에 `__CLAW_RESTART__` 마커 → claw가 제거 후 `process.exit(0)`. 새 인스턴스 기동 경로는 `OPS.md` 참조.
- 메시지 큐: 재시작 중 수신 메시지는 SQLite `message_queue` 보관 → 재시작 후 자동 처리.
- 뮤텍스: thread별 `runWithMutex()` — 동일 thread 동시 실행 방지.
- 세션 추적: SQLite `sessions` — `thread_id` → `claude_session_id` 매핑.

## 디버깅 절차

1. 최근 이벤트: `data/claw.db` → `SELECT * FROM events ORDER BY ts DESC LIMIT 20;`
2. 최근 로그: `logs/` 디렉토리 확인
3. 재현 가능하면 `__tests__/` 아래 단위 테스트 추가
4. 수정 후 `pnpm build` → 응답에 재시작 마커 포함

## 소스 변경 시 필수

- 빌드: `pnpm build`
- 재시작: 응답에 `__CLAW_RESTART__` (앞에 사람 읽을 텍스트 한 줄 필수)
- 자세한 절차·에러 대응: `OPS.md`
