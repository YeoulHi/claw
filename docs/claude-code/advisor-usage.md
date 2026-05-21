---
name: advisor-usage
description: claw에서 Advisor(Claude Code)를 사용하는 목적, 기대효과, 핵심 함수 및 흐름 정리
toc:
  - Advisor란 무엇인가
  - 사용 SDK와 실행 방식
  - runClaude() 함수 상세
  - Advisor가 호출되는 조건과 흐름
  - 스킬 감지 시스템
  - 기대효과
  - 관련 파일 목록
---

# claw에서의 Advisor 사용

## Advisor란 무엇인가

claw에서 "Advisor"는 **Claude Code 에이전트를 서브에이전트로 활용하는 패턴**이다.  
구조 설계, 스키마 결정, 아키텍처 선택 등 복잡한 판단이 필요할 때, 메인 Claude 에이전트가 별도의 Claude Code 세션("advisor")을 호출해 전문적 의견을 구한다.

Claude Code 자체에 `advisor` 내장 도구가 있으며, claw는 이를 skill 시스템을 통해 **자동 라우팅**한다.

---

## 사용 SDK와 실행 방식

claw는 공식 Claude Agent SDK 라이브러리(`@anthropic-ai/claude-agent-sdk`)를 직접 import하지 않는다.  
대신 **Claude Code CLI 바이너리(`claude`)를 자식 프로세스로 직접 spawn**하는 방식을 사용한다.

```
[Discord 메시지] → [claw 오케스트레이터] → [runClaude()] → [claude CLI 바이너리 spawn]
                                                               ↓
                                                      Claude Agent 루프 실행
                                                      (파일 읽기, 코드 편집, advisor 호출 등)
```

이 방식은 Claude Agent SDK가 내부적으로 하는 것과 동일하다. SDK는 CLI 바이너리를 번들링하고 같은 인터페이스로 래핑할 뿐이다.

**환경 변수로 바이너리 경로 오버라이드 가능:**
```bash
CLAUDE_BIN=/custom/path/to/claude
```

---

## runClaude() 함수 상세

**파일:** `src/claude.ts:336`

### 함수 시그니처

```typescript
export function runClaude(opts: ClaudeRunOptions): Promise<ClaudeRunResult>
```

### ClaudeRunOptions

```typescript
interface ClaudeRunOptions {
  cwd: string;           // Claude 세션의 작업 디렉토리 (CLAUDE.md, .claude/skills/ 탐색 기준)
  prompt: string;        // 사용자 메시지 (stdin으로 전달, 쉘 이스케이프 불필요)
  resume?: string;       // 재개할 세션 ID (없으면 새 세션 시작)
  systemAppend?: string; // 추가 시스템 지시 (프롬프트 뒤에 "---" 구분자로 덧붙임)
  model?: string;        // 모델 오버라이드 (예: 'claude-haiku-4-5-20251001')
  signal?: AbortSignal;  // 취소 신호
  timeoutMs?: number;    // 타임아웃 ms (기본: 600,000 = 10분)
}
```

### ClaudeRunResult

```typescript
interface ClaudeRunResult {
  text: string;               // 어시스턴트 최종 응답 텍스트
  sessionId: string;          // 다음 --resume에 사용할 세션 ID
  durationMs: number;         // 실제 소요 시간
  exitCode: number;           // claude 프로세스 종료 코드 (0 = 성공)
  artifacts: Artifact[];      // 텍스트에서 파싱된 아티팩트 마커 (파일 첨부, URL 링크)
  contextWindowUsed: number;  // 현재 컨텍스트 윈도우 사용량 (입력+출력+캐시 토큰)
  contextWindowMax: number;   // 모델 최대 컨텍스트 윈도우 크기
  costUsd: number;            // 이번 호출 API 비용 (USD)
}
```

### 내부 동작

1. `claude --help`로 CLI 기능 자동 감지 (`stream-json` / `json` / `text` 출력 모드)
2. CLI args 구성: `--print --dangerously-skip-permissions --output-format=stream-json --verbose --include-partial-messages`
3. stdin으로 프롬프트 전달 (쉘 이스케이프 없이 안전하게 전달)
4. stdout의 NDJSON 스트림 파싱 → 세션 ID, 응답 텍스트, 비용, 컨텍스트 크기 추출
5. 타임아웃 시 SIGTERM → 5초 후 SIGKILL

---

## Advisor가 호출되는 조건과 흐름

### 트리거 조건 (advisor-routing skill)

다음 패턴이 사용자 메시지에 감지되면 advisor 위임이 활성화됨:

- 스키마·데이터 구조 설계: "스키마 만들자", "구조 어떻게 잡을지", "어떤 필드가 필요한지"
- 아키텍처 의사결정: "어떻게 설계할지", "어떻게 만들면 좋을지", "처음부터 좋은 구조로"
- 방향 불확실: "뭐가 좋을까", "어떤 방식이 나을지", "방향을 잡고 싶어"
- 직접 요청: "advisor와 이야기해봐", "advisor한테 물어봐"

### 실행 흐름

```
사용자 메시지 수신
      ↓
detectSkill() — Claude Haiku(20ms 제한)로 적합한 skill 감지
      ↓
advisor-routing skill 감지됨
      ↓
skill 내용을 systemAppend에 주입:
  "# 활성 Skill: advisor-routing\n\n{SKILL.md 본문}\n\n---\n{기본 시스템 프롬프트}"
      ↓
runClaude() 호출 — Claude(메인 모델)가 skill 지시에 따라
      ↓
"→ 구조 설계 판단이 필요해 advisor에게 위임했습니다." 한 줄 고지 후
Claude Code 내장 advisor() 도구 호출
      ↓
advisor 응답 → 사용자에게 전달 → 방향 확정 후 구현
```

---

## 스킬 감지 시스템

### detectSkill()

**파일:** `src/orchestrator/skill-detector.ts:98`

```typescript
export async function detectSkill(args: DetectSkillArgs): Promise<DetectSkillResult>

interface DetectSkillArgs {
  userMessage: string;
  previousResponse?: string | null;  // 직전 에이전트 응답 (캐시 용도)
  cachedSkill?: string | null;        // 이전 세션의 스킬 (단문 확인어 처리용)
  skillsDir: string;                  // 스킬 디렉토리 경로
}

interface DetectSkillResult {
  skill: string | null;    // 감지된 스킬 이름
  content: string | null;  // SKILL.md 본문 (systemAppend에 주입할 내용)
}
```

**감지 모델:** `claude-haiku-4-5-20251001` (타임아웃: 20초)

**단문 캐시 최적화:** 이전 스킬이 있고 메시지가 15자 이하 + 개행 없으면 → Haiku 호출 없이 캐시된 스킬 재사용  
("응", "그래", "ok" 같은 확인어가 advisor-routing 세션 도중에 오면 advisor-routing 유지)

### 스킬 우선순위

| 위치 | 경로 | 로드 주체 |
|------|------|----------|
| Claw 글로벌 | `claw/skills/{name}/SKILL.md` | claw 오케스트레이터 |
| Repo 로컬 | `{repo}/.claude/skills/{name}/SKILL.md` | Claude Code 에이전트 |

Repo skill은 `cwd`가 해당 레포의 로컬 경로일 때 Claude Code 에이전트 자체가 자동 로드.

---

## 기대효과

| 문제 | Advisor 도입 후 |
|------|----------------|
| 스키마 설계를 즉시 구현 → 방향 틀려 전면 수정 | advisor에서 방향 확정 후 구현 → 재작업 최소화 |
| 유저가 "위임할까요?" 질문에 매번 응답해야 함 | 자동 위임 + 한 줄 고지로 라운드트립 1회 절감 |
| 아키텍처 결정이 구현자(Claude)의 즉흥 판단에 의존 | advisor라는 별도 판단 채널로 결정 품질 분리 |

---

## 관련 파일 목록

| 파일 | 역할 |
|------|------|
| `src/claude.ts` | `runClaude()` 구현 — CLI 바이너리 spawn 래퍼 |
| `src/orchestrator/skill-detector.ts` | `detectSkill()` — Haiku로 skill 감지 |
| `src/adapters/discord.ts:610` | 레포 작업 흐름에서 detectSkill + runClaude 통합 |
| `src/adapters/discord.ts:912` | Claw 유지보수 흐름에서 detectSkill + runClaude 통합 |
| `src/state/sessions.ts` | `lastSkill` 세션 저장 (단문 캐시용) |
| `skills/advisor-routing/SKILL.md` | advisor 자동 위임 규칙 정의 |
| `.claude/skills/advisor-verbose/SKILL.md` | advisor 응답 원문 출력 slash command |
