# claw — Codex 작업 지침

> 운영 문제(재시작 실패, 포트 충돌, 빌드 반영 등)는 **[`OPS.md`](./OPS.md)** 정본 참조.

## 재시작 마커 (`__CLAW_RESTART__`) 사용 규칙

claw가 응답 본문에서 마커를 검출하면 제거 후 프로세스를 재시작한다 (Windows에서는 `process.exit(0)` → 외부 재기동 경로 / Discord 재시작 흐름 사용. 자세한 절차는 `OPS.md`).
마커가 제거되면 남은 텍스트가 Discord에 전송되므로, **마커만 단독으로 출력하면 빈 메시지가 전달된다.**

**규칙: 마커 앞에 반드시 사람이 읽을 수 있는 텍스트를 한 줄 이상 포함할 것.**

```
# 올바른 예
재시작합니다.

__CLAW_RESTART__

# 잘못된 예 (Discord에 빈 메시지 전송됨)
__CLAW_RESTART__
```

---

## Skills 시스템

### 개요

claw는 자체 skill 감지·주입 시스템을 갖는다. 유저 메시지가 들어오면 Haiku가 적합한 skill을 감지하고, 해당 skill의 내용을 메인 LLM 호출 시 systemAppend에 자동 주입한다.

### 디렉토리 구조

```
claw/
└── skills/
    └── {skill-name}/
        └── SKILL.md      # 필수. frontmatter에 name, description, triggers 포함
```

### SKILL.md 포맷

```markdown
---
name: skill-name
description: 한 줄 설명 (Haiku 분류기가 skill 선택 시 사용)
triggers:
  - 트리거 키워드/패턴 예시 1
  - 트리거 키워드/패턴 예시 2
---

# (skill 본문 — 메인 LLM systemAppend에 주입되는 실제 내용)
```

### Claw skill vs Repo skill 구분 원칙

| 기준 | Claw skill | Repo (Codex) skill |
|------|-----------|--------------------------|
| 저장 위치 | `claw/skills/` | `{repo}/.Codex/skills/` |
| 주입 주체 | claw 오케스트레이터 (세션 시작 전) | Codex 에이전트 (세션 도중) |
| 대상 | 인터랙션 패턴 / 커뮤니케이션 방식 | 코드베이스 내 구현 패턴 |
| 핵심 질문 | "레포가 달라져도 이 지식이 필요한가?" | "이 레포 코드를 알아야 쓸 수 있는가?" |

**Claw skill에 속하는 것:**
- 커뮤니케이션 (B2B 이메일 초안, 캘린더 미팅 협의)
- claw 시스템 자체 지식 (디버그, 재시작 패턴, 아키텍처)
- 레포에 무관하게 반복되는 크로스커팅 인터랙션 패턴

**Repo skill에 속하는 것:**
- 레포 내 코드 생성/수정 패턴 (API 추가, DB 쿼리 등)
- 레포 전용 CLI/스크립트 사용법
- 해당 레포 코드베이스 지식 없이는 쓸 수 없는 것

**중복 시:** repo skill로 단일화. claw skill은 repo skill 호출을 유도하는 힌트만 제공.

### "이건 claw skill로 추가해두자" 명령 처리

유저가 위 표현으로 명령하면:
1. `skills/{적절한-이름}/SKILL.md` 파일 생성
2. frontmatter에 name, description, triggers 작성
3. 본문에 주입할 실제 지침 내용 작성
4. git commit & push (소스 변경 아니므로 `pnpm build` 불필요, 재시작 마커 불필요)

### Skill 개선 논의 진입 전 확인 원칙

유저가 "스킬 개선하자", "갭 분석해줘", "이 스킬 손봐야 할 것 같아" 등 스킬 개선 요청을 하면, **갭 분석 전에 반드시 아래 두 가지를 먼저 확인한다.**

1. **사용 시나리오** — 이 스킬을 언제, 어떤 상황에서 쓸 예정인가?
2. **기대 산출물** — 한 번 쓰고 나면 손에 뭘 쥐고 있어야 하는가?

두 가지를 확인한 후에 분석 및 개선안 제안에 진입한다.
목적·기대결과가 명확하지 않은 상태에서 갭 분석을 시작하면 구현 도중 목적이 재정의되어 작업을 두 번 하게 된다.

---

### Skill 작성 검증 원칙

**스크립트·외부 라이브러리가 포함된 skill은 실행 검증 전 SKILL.md 초안 작성 금지.**

순서:
1. 실제 환경에서 설치·실행 테스트
2. 정확한 명령어·경로 확인
3. 확인된 내용으로 SKILL.md 작성

이유: 검증 전 선작성 시 설치 명령어·경로가 틀려 SKILL.md를 이중 수정하게 됨.
