---
id: "0008"
title: "wiki 공간 재정의 — 사람 vs agent 역할 분리"
type: one-off
cluster: wiki
status: open
eval: ~
created: 2026-05-21
---

## 핵심 관점

Karpathy의 llm-wiki 패턴을 검토하면서 도출된 설계 원칙:

- **wiki = 지식의 평준화** — 중립적 사실, 외부 자료의 컴파일. agent가 작성·관리.
- **비교 사유 공간 = 지식의 비교와 누적** — 사람의 비교 의지와 의도가 전제. agent가 자동으로 채울 수 없음.

Karpathy는 이 둘을 wiki 하나에 합쳤지만(`comparisons/` 포함), 책임 분리 관점에서는 공간을 나눠야 한다.

## 설계 방향

| 공간 | 작성 주체 | 성격 | 현재 상태 |
|------|-----------|------|-----------|
| `wiki/` | **agent** | 평준화된 사실, 외부 자료 요약, 중립적 참조 | 존재함 |
| `[새 공간 — 이름 TBD]` | **사람** | 비교에서 나온 생각, 주관적 판단, 누적되는 사유 | 없음 |

새 공간 이름 후보: `thoughts/`, `notes/`, `memo/` — 구현 시 결정.

## 작업 항목

### Phase 0 — wiki 역할 재정의 (문서)

- [ ] `wiki/` 폴더의 역할을 "agent 작성 영역, 평준화 사실" 로 명시
  - CLAUDE.md 또는 wiki/SCHEMA.md에 "사람이 직접 편집하지 않는 영역" 명시
- [ ] 새 공간(`thoughts/` 등) 이름·위치·포맷 결정
  - 포맷: 날짜 + 주제 + 비교 대상 + 나의 판단 (frontmatter TBD)

### Phase 1 — wiki frontmatter 강화 (agent 영역 정비)

- [ ] 기존 wiki 아티클에 `type`, `related`, `confidence` 필드 추가
  - `type`: concept | entity | source-summary (comparison은 wiki 밖으로)
  - `related`: 연관 wiki 아티클 id 리스트
  - `confidence`: high | medium | low
- [ ] `wiki/index.md` 생성 — agent가 관리하는 카탈로그

### Phase 2 — 새 공간 구축 (사람 영역)

- [ ] 이름 확정 후 폴더 생성
- [ ] frontmatter 스키마 설계: 비교 대상, 날짜, 결론, 참조 wiki 아티클
- [ ] Repo skill `thoughts-writer` (또는 확정된 이름) 작성 — 사람이 비교 의도를 표현하면 포맷 잡아주는 보조 역할

## 참고

- wiki/0004-karpathy-llm-wiki-pattern.md — Karpathy 패턴 분석 + claw 적용 지도
- Karpathy Gist: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
