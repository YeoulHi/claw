---
name: sdk-official
description: Claude Agent SDK 공식 문서 원문 (code.claude.com/docs/en/agent-sdk)
toc:
  - Agent SDK 개요
  - 빠른 시작
  - 내장 도구 목록
  - Hooks
  - Subagents
  - MCP
  - Permissions
  - Sessions
  - Claude Code 파일 기반 설정
  - 다른 Claude 도구와 비교
---

> 원문 출처: https://code.claude.com/docs/en/agent-sdk  
> 수집일: 2026-05-21

---

# Agent SDK overview

> Build production AI agents with Claude Code as a library

> **Notice:** Starting June 15, 2026, Agent SDK and `claude -p` usage on subscription plans will draw from a new monthly Agent SDK credit, separate from your interactive usage limits.

Build AI agents that autonomously read files, run commands, search the web, edit code, and more. The Agent SDK gives you the same tools, agent loop, and context management that power Claude Code, programmable in Python and TypeScript.

```python
# Python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find and fix the bug in auth.py",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"]),
    ):
        print(message)  # Claude reads the file, finds the bug, edits it

asyncio.run(main())
```

```typescript
// TypeScript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.ts",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  console.log(message);
}
```

---

## 설치

```bash
# TypeScript
npm install @anthropic-ai/claude-agent-sdk

# Python
pip install claude-agent-sdk
```

> TypeScript SDK는 플랫폼별 Claude Code 바이너리를 optional dependency로 번들링하므로 Claude Code를 별도 설치할 필요 없음.

### API 키 설정

```bash
export ANTHROPIC_API_KEY=your-api-key
```

서드파티 인증 방법:
- **Amazon Bedrock**: `CLAUDE_CODE_USE_BEDROCK=1`
- **Claude Platform on AWS**: `CLAUDE_CODE_USE_ANTHROPIC_AWS=1`
- **Google Vertex AI**: `CLAUDE_CODE_USE_VERTEX=1`
- **Microsoft Azure**: `CLAUDE_CODE_USE_FOUNDRY=1`

---

## 내장 도구 목록

| 도구 | 기능 |
|------|------|
| **Read** | 작업 디렉토리의 모든 파일 읽기 |
| **Write** | 새 파일 생성 |
| **Edit** | 기존 파일 정밀 편집 |
| **Bash** | 터미널 명령, 스크립트, git 작업 실행 |
| **Monitor** | 백그라운드 스크립트 감시 및 출력 라인별 이벤트 처리 |
| **Glob** | 패턴으로 파일 검색 (`**/*.ts`, `src/**/*.py`) |
| **Grep** | 정규식으로 파일 내용 검색 |
| **WebSearch** | 최신 정보 웹 검색 |
| **WebFetch** | 웹 페이지 내용 fetch 및 파싱 |
| **AskUserQuestion** | 사용자에게 선택지 포함 명확화 질문 |

---

## Hooks

에이전트 라이프사이클의 핵심 시점에 커스텀 코드 실행. 콜백 함수로 검증, 로깅, 차단, 변환 가능.

**사용 가능한 훅:** `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit` 등

```python
# 파일 변경 감사 로그 예시
import asyncio
from datetime import datetime
from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher

async def log_file_change(input_data, tool_use_id, context):
    file_path = input_data.get("tool_input", {}).get("file_path", "unknown")
    with open("./audit.log", "a") as f:
        f.write(f"{datetime.now()}: modified {file_path}\n")
    return {}

async def main():
    async for message in query(
        prompt="Refactor utils.py to improve readability",
        options=ClaudeAgentOptions(
            permission_mode="acceptEdits",
            hooks={
                "PostToolUse": [
                    HookMatcher(matcher="Edit|Write", hooks=[log_file_change])
                ]
            },
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)
```

```typescript
// TypeScript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { appendFile } from "fs/promises";

const logFileChange: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "unknown";
  await appendFile("./audit.log", `${new Date().toISOString()}: modified ${filePath}\n`);
  return {};
};

for await (const message of query({
  prompt: "Refactor utils.py to improve readability",
  options: {
    permissionMode: "acceptEdits",
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [logFileChange] }]
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

---

## Subagents

전문화된 서브에이전트를 스폰하여 집중 서브태스크 처리. 메인 에이전트가 작업을 위임하고 서브에이전트가 결과를 반환.

`allowed_tools`에 `Agent`를 포함해야 함 (서브에이전트는 Agent 도구를 통해 호출됨):

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

async def main():
    async for message in query(
        prompt="Use the code-reviewer agent to review this codebase",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep", "Agent"],
            agents={
                "code-reviewer": AgentDefinition(
                    description="Expert code reviewer for quality and security reviews.",
                    prompt="Analyze code quality and suggest improvements.",
                    tools=["Read", "Glob", "Grep"],
                )
            },
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)
```

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Use the code-reviewer agent to review this codebase",
  options: {
    allowedTools: ["Read", "Glob", "Grep", "Agent"],
    agents: {
      "code-reviewer": {
        description: "Expert code reviewer for quality and security reviews.",
        prompt: "Analyze code quality and suggest improvements.",
        tools: ["Read", "Glob", "Grep"]
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

서브에이전트 컨텍스트 내 메시지에는 `parent_tool_use_id` 필드가 포함되어 어떤 서브에이전트 실행에 속하는지 추적 가능.

---

## MCP (Model Context Protocol)

데이터베이스, 브라우저, API 등 외부 시스템 연결. [수백 가지 MCP 서버](https://github.com/modelcontextprotocol/servers) 지원.

```python
# Playwright 브라우저 자동화 예시
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Open example.com and describe what you see",
        options=ClaudeAgentOptions(
            mcp_servers={
                "playwright": {"command": "npx", "args": ["@playwright/mcp@latest"]}
            }
        ),
    ):
        if hasattr(message, "result"):
            print(message.result)
```

---

## Permissions

에이전트가 사용할 수 있는 도구를 정밀 제어.

```python
# 읽기 전용 에이전트 예시
async for message in query(
    prompt="Review this code for best practices",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep"],
    ),
):
    if hasattr(message, "result"):
        print(message.result)
```

---

## Sessions

여러 교환에 걸쳐 컨텍스트 유지. Claude는 읽은 파일, 완료한 분석, 대화 이력을 기억함. 나중에 세션 재개 또는 포크 가능.

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, SystemMessage, ResultMessage

async def main():
    session_id = None

    # 첫 번째 쿼리: 세션 ID 캡처
    async for message in query(
        prompt="Read the authentication module",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Glob"]),
    ):
        if isinstance(message, SystemMessage) and message.subtype == "init":
            session_id = message.data["session_id"]

    # 전체 컨텍스트와 함께 재개
    async for message in query(
        prompt="Now find all places that call it",  # "it" = auth module
        options=ClaudeAgentOptions(resume=session_id),
    ):
        if isinstance(message, ResultMessage):
            print(message.result)
```

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

let sessionId: string | undefined;

for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

for await (const message of query({
  prompt: "Now find all places that call it",
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

---

## Claude Code 파일 기반 설정

SDK는 Claude Code의 파일시스템 기반 설정을 지원. 기본적으로 작업 디렉토리의 `.claude/`와 `~/.claude/`에서 로드.

| 기능 | 설명 | 위치 |
|------|------|------|
| **Skills** | 마크다운으로 정의된 전문화 역량 | `.claude/skills/*/SKILL.md` |
| **Slash commands** | 공통 작업을 위한 커스텀 명령 | `.claude/commands/*.md` |
| **Memory** | 프로젝트 컨텍스트 및 지시사항 | `CLAUDE.md` 또는 `.claude/CLAUDE.md` |
| **Plugins** | 커스텀 명령, 에이전트, MCP 서버 확장 | `plugins` 옵션으로 프로그래밍 방식 |

---

## 다른 Claude 도구와 비교

### Agent SDK vs Client SDK

| | Agent SDK | Client SDK |
|-|-----------|------------|
| 도구 실행 | Claude가 자율적으로 처리 | 개발자가 직접 구현 |
| 용도 | 자율 에이전트 | 단순 메시지 교환 |

```python
# Client SDK: 도구 루프를 직접 구현해야 함
response = client.messages.create(...)
while response.stop_reason == "tool_use":
    result = your_tool_executor(response.tool_use)
    response = client.messages.create(tool_result=result, **params)

# Agent SDK: Claude가 도구를 자율적으로 처리
async for message in query(prompt="Fix the bug in auth.py"):
    print(message)
```

### Agent SDK vs Claude Code CLI

| 사용 사례 | 최적 선택 |
|-----------|-----------|
| 인터랙티브 개발 | CLI |
| CI/CD 파이프라인 | SDK |
| 커스텀 애플리케이션 | SDK |
| 일회성 작업 | CLI |
| 프로덕션 자동화 | SDK |

### Agent SDK vs Managed Agents

| | Agent SDK | Managed Agents |
|-|-----------|----------------|
| **실행 위치** | 내 프로세스, 내 인프라 | Anthropic 관리 인프라 |
| **인터페이스** | Python/TypeScript 라이브러리 | REST API |
| **에이전트 작업 대상** | 내 인프라의 파일 | 세션별 관리 샌드박스 |
| **세션 상태** | 파일시스템의 JSONL | Anthropic 호스팅 이벤트 로그 |
| **커스텀 도구** | 인-프로세스 Python/TypeScript 함수 | Claude가 트리거, 개발자가 실행 후 결과 반환 |
| **최적 사용** | 로컬 프로토타이핑, 파일시스템 직접 작업 | 샌드박스/세션 인프라 없이 프로덕션 에이전트 |

---

## 관련 링크

- TypeScript CHANGELOG: https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md
- Python CHANGELOG: https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md
- 이슈 리포트 (TS): https://github.com/anthropics/claude-agent-sdk-typescript/issues
- 이슈 리포트 (Python): https://github.com/anthropics/claude-agent-sdk-python/issues
