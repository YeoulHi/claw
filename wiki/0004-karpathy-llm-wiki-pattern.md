---
id: "0004"
title: "Karpathy — LLM Wiki 패턴: RAG 대신 컴파일된 지식 베이스"
url: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
source: Andrej Karpathy (GitHub Gist)
saved: 2026-05-21
tags: [wiki, knowledge-management, rag, llm, architecture]
type: concept
related:
  - 0001-langchain-trajectory-vs-output-eval
confidence: high
applied_in: []
---

## 핵심 인사이트

- **문제**: RAG는 매 쿼리마다 원본에서 지식을 재발견 — 학습·누적이 없음
- **해결**: LLM이 원본을 한 번 읽고 구조화된 위키로 **컴파일** → 이후 쿼리는 컴파일된 wiki 활용
- **비유**: "Obsidian = IDE, LLM = 프로그래머, Wiki = 코드베이스"
- 지식이 **누적·복리 성장** — cross-reference, 모순 감지, 고아 페이지 추적이 이미 완료된 상태로 저장됨

## 3계층 아키텍처

```
raw/        ← 불변 원본 (논문, 기사, 코드) — LLM은 읽기만
wiki/       ← LLM이 직접 작성·관리 (컴파일된 지식)
CLAUDE.md   ← 스키마 정의 (LLM에게 구조·규칙 지시)
```

## 3가지 핵심 작업

| 작업 | 설명 |
|------|------|
| **Ingest** | 새 자료 추가 시 요약 페이지 생성 + 기존 개념/엔티티 페이지 업데이트 + cross-link 추가 (소스 1개 → 10~15개 페이지 건드림) |
| **Query** | index.md에서 관련 페이지 찾아 읽고 인용 포함 답변 생성, 중요 답변은 새 wiki 페이지로 저장 |
| **Lint** | 주기적 health-check — 모순 감지, 고아 페이지 탐지, 오래된 정보 갱신 |

## Karpathy가 제안한 wiki 구조

```
wiki/
├── index.md        # 전체 페이지 카탈로그 (Obsidian [[wiki-link]] 스타일)
├── log.md          # append-only 인제스트 활동 기록
├── overview.md     # 고수준 종합
├── concepts/
├── entities/
├── sources/        # 원본 요약 페이지
└── comparisons/
```

## Karpathy 제안 frontmatter 필드

```yaml
type: concept | entity | source-summary | comparison
sources: [raw/ 파일 경로들]
related: [연결된 wiki 페이지들]
updated: YYYY-MM-DD
confidence: high | medium | low
```

## claw wiki 적용 아이디어

현재 claw wiki는 `0001-langchain-...` 스타일의 flat 구조 + 기본 frontmatter.
Karpathy 패턴에서 접목 가능한 것:

1. **frontmatter 강화**: `type`, `related`, `confidence` 필드 추가
2. **`wiki/index.md`** 생성: 모든 아티클 카탈로그 (자동 또는 수동 관리)
3. **`wiki/log.md`** 생성: 아티클 추가·수정 이력 append-only 기록
4. **Ingest 워크플로 skill**: 외부 자료 → wiki 아티클 생성 + 기존 아티클 cross-link 업데이트 플로우
5. **Lint 주기**: 고아 페이지(applied_in이 비어있는 오래된 아티클), 모순, 미연결 관련 개념 감지

## 원문 발췌

> "Every time new information comes in, the LLM doesn't just store the raw source—it updates the compiled wiki. Cross-references are maintained, contradictions are flagged, orphan pages are tracked."

> "Think of it like a compiler: the raw sources are the source code, the wiki is the compiled binary, and CLAUDE.md is the build system."
