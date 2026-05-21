---
name: claude-code-docs
description: Claude Agent SDK 및 claw의 Advisor 패턴 문서 모음
toc:
  - 파일 목록
  - 빠른 참조
---

# Claude Code 문서

| 파일 | 설명 |
|------|------|
| [sdk-official.md](sdk-official.md) | Claude Agent SDK 공식 문서 원문 (설치, 빌트인 도구, Hooks, Subagents, MCP, Sessions 등) |
| [advisor-usage.md](advisor-usage.md) | claw에서 Advisor를 사용하는 목적·기대효과·핵심 함수(`runClaude`, `detectSkill`) 및 실행 흐름 |

---

## 빠른 참조

**claw가 Claude를 실행하는 방법**
→ `src/claude.ts:336` — `runClaude()`: `claude` CLI 바이너리를 자식 프로세스로 spawn

**Advisor가 자동 위임되는 조건**
→ `skills/advisor-routing/SKILL.md` — 스키마 설계·아키텍처 결정 패턴 감지 시

**스킬 감지 모델**
→ `claude-haiku-4-5-20251001` (타임아웃 20초) — `src/orchestrator/skill-detector.ts:98`

**공식 SDK 패키지명**
→ TypeScript: `@anthropic-ai/claude-agent-sdk` / Python: `claude-agent-sdk`
