---
name: worktree-design
description: 여러 worktree에서 동시에 수정 가능한 shared file을 설계할 때 advisor에게 충돌 리스크 검토를 위임하는 패턴
triggers:
  - _index.yaml 설계
  - 공유 파일
  - shared file
  - worktree 병렬
  - 인덱스 파일 만들자
  - 중앙 집중
  - 단일 파일로 관리
  - 여러 세션이 동시에
  - worktree 충돌
  - AGENTS.md 수정
  - config 파일 설계
---

# Worktree 설계 — advisor 충돌 리스크 검토 위임

## 언제 적용하는가

다음 패턴 중 하나라도 감지되면 **advisor에게 먼저 리뷰를 위임**한다:

- **shared mutable 파일 설계**: 여러 worktree 세션이 동시에 읽고 쓸 수 있는 단일 파일 (`_index.yaml`, `AGENTS.md`, `config.json` 등)
- **중앙 집중형 상태 관리**: "하나의 파일에 모든 상태를 모아서 관리"하는 설계
- **인덱스/집계 파일 신규 생성**: 여러 작업 결과를 하나의 파일에 기록하는 구조
- **worktree 병렬 작업이 예상되는 설계 변경**: worktree가 여럿 열려 있거나 열릴 가능성이 있는 레포

## 적용 순서

1. **즉시 advisor 위임** — 사용자 확인 없이 advisor에게 worktree 충돌 리스크 리뷰를 요청한다
2. **위임 사실 한 줄 고지** — "→ worktree 충돌 리스크 검토가 필요해 advisor에게 위임했습니다." 형식으로 한 줄만
3. **advisor 결과 전달** — advisor의 리뷰 결과를 사용자에게 전달
4. **방향 확정 후 구현 착수**

## Advisor 리뷰 요청 시 전달할 체크리스트

advisor에게 위임할 때 다음 질문들을 포함해 검토를 요청한다:

```
[Worktree 충돌 리스크 리뷰 요청]

설계 대상: {파일명 또는 설계 내용}

확인 항목:
1. 이 파일/구조를 여러 worktree가 동시에 수정할 가능성이 있는가?
2. 동시 수정 시 merge conflict가 발생하는가? (YAML/JSON 구조 포함)
3. "status만 frontmatter에 저장"하는 분산 방식으로 대체 가능한가?
4. 파일 이동보다 status 변경만으로 처리 가능한가?
5. 고위험이면: 분산 구조(per-file frontmatter) 또는 read-only 전환 권장
```

## Shared Mutable File 고위험 패턴 (자동 경고)

아래 패턴이 감지되면 advisor 위임 전에 먼저 경고를 출력한다:

| 패턴 | 리스크 | 권장 대안 |
|------|--------|-----------|
| 단일 `_index.yaml`에 status 저장 | worktree merge conflict | 각 `.md` frontmatter에 status 분산 |
| `AGENTS.md`를 여러 세션이 수정 | 동시 편집 충돌 | read-only + 세션별 별도 파일 |
| 집계 결과를 단일 JSON에 누적 | append 충돌 | 파일별 독립 결과 파일 + 집계는 별도 단계 |
| 중앙 config를 worktree 내에서 수정 | 예상치 못한 설정 override | config는 root에만, worktree는 read-only |

## 예외: advisor 위임 생략 가능한 경우

- 단일 worktree 환경 (병렬 작업 없음)이 명확한 경우
- 파일이 read-only이거나 append-only (충돌 없음)인 경우
- 사용자가 리스크를 인지하고 명시적으로 수락한 경우
