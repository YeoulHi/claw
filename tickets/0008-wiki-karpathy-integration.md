---
id: "0008"
title: "Karpathy llm-wiki 패턴 접목 — wiki 시스템 강화"
type: one-off
cluster: wiki
status: open
eval: ~
created: 2026-05-21
---

## 배경

Karpathy의 llm-wiki 패턴 조사 결과 (→ wiki/0004-karpathy-llm-wiki-pattern.md):
- RAG 대신 "LLM이 wiki를 점진적 컴파일·유지"하는 접근
- raw → wiki → CLAUDE.md 3계층 + Ingest/Query/Lint 3작업
- frontmatter에 type, related, confidence 필드로 지식 그래프 형성

claw의 현재 wiki는 flat + 기본 frontmatter. 이번 티켓으로 구조적 강화.

## 목표

Karpathy 패턴에서 선별한 아이디어를 claw wiki 시스템에 단계적으로 접목.

## 작업 항목

### Phase 1 — Frontmatter 강화 (낮은 비용, 높은 즉시 효과)

- [ ] 기존 wiki 아티클 4개에 `type`, `related`, `confidence` 필드 추가
- [ ] wiki 아티클 포맷 기준을 CLAUDE.md 또는 wiki/SCHEMA.md에 문서화
  - `type`: concept | entity | source-summary | comparison
  - `related`: 연관 wiki 아티클 id 리스트
  - `confidence`: high | medium | low

### Phase 2 — 카탈로그 & 로그 인프라

- [ ] `wiki/index.md` 생성 — 모든 아티클 카탈로그 (id, title, type, tags 한 줄 요약)
- [ ] `wiki/log.md` 생성 — append-only 인제스트 로그 (`## [날짜] ingest | 제목` 포맷)

### Phase 3 — Skill 추가

- [ ] Repo skill `wiki-article-writer` (`.claude/skills/`) 작성
  - Ingest 워크플로: 외부 자료 → frontmatter 채우기 → cross-link 업데이트 → log.md 기록
  - 현재 wiki 파일명 규칙(NNNN-*.md), frontmatter 스키마 주입
- [ ] Claw skill `wiki-lint` (`claw/skills/`) 검토
  - 고아 페이지 (applied_in 비어있고 저장 후 2주 이상 경과)
  - 미연결 관련 개념 (같은 태그인데 related에 없는 아티클)

## 우선순위

Phase 1 → Phase 2 → Phase 3 순. Phase 1만 해도 즉시 가치.

## 참고

- wiki/0004-karpathy-llm-wiki-pattern.md — 원본 아이디어 및 적용 지도
- Karpathy Gist: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
