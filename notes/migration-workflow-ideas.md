# Migration Workflow — 아이디어 노트

> 이번 마이그레이션(yeojin-context-hub)에서 효과적이었던 패턴 기록.
> 특수 작업(마이그레이션/대규모 리팩토링)에 재사용 가능한 힌트 모음.

## 핵심 패턴

```
tickets/
  _index.yaml                # 전체 티켓 목록 + 상태 SSOT
  001-some-task/
    ticket.yaml              # 메타: id, title, status, purpose, cluster
    task.json                # 세부 step 정의
    run.ps1 (또는 .sh)       # 실행 스크립트
    eval/
      result.yaml            # PASS/FAIL 결과
```

## 무엇이 잘 작동했나

- **ticket → task.json → run.ps1 → eval** 선형 흐름이 에이전트와 사람 모두에게 명확함
- dry-run → 검토 → apply → eval → commit 순서 준수 시 되돌리기 쉬움
- `_index.yaml`이 단일 상태 뷰 역할 → 다음 pending 탐색이 O(1)

## 반복 패턴에서 배운 교훈

- "하나씩, 결과만" 원칙: 여러 티켓 동시 진행 시 컨텍스트 혼선 발생
- 보고 형식: `{ticket-id} {제목} — N/N PASS` 한 줄이면 충분
- pending 티켓이 명확하면 다음 단계를 자동 진행해도 됨

## 범용화 방향

이 패턴을 claw 범용 인프라로 확장하는 작업은 **tickets/0002~0005**에서 진행.
- ticket 스키마에 `type` 필드 추가 → 마이그레이션/리팩토링/배치 구분
- result.yaml 표준화 → SDK로 전체 집계 가능
- run-ticket skill → ticket id만 주면 자동 실행
