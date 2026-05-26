---
name: session-wrap
description: 세션 종료 시 맥락 업데이트 자동화 — Advisor→JSON→병렬 에이전트→2사이클 검증→커밋 플로우 실행. 별칭: end
triggers:
  - end
  - 오래됐거나
  - 업데이트할 것 수정
  - 맥락 정리
  - 맥락 업데이트
  - 세션 마무리
  - 오늘 정리
  - 마무리하자
  - 여기까지
  - context 업데이트
  - 컨텍스트 정리
  - 오래된 거 고쳐
  - wrap-up
  - 산출물 점검
---

# 세션 마무리 — 맥락 업데이트 플로우

## 역할
세션 종료 신호가 감지되면 yeojin-context-hub의 맥락 문서를 최신 상태로 업데이트하는 표준 플로우를 실행한다.
compact 전에는 이번 세션 산출물과 변경 의도를 먼저 점검하고, 사용자가 남긴 최신 지시가 오래된 목표보다 우선하는지 확인한다.

claw는 Discord 진입점과 경량 오케스트레이션만 담당한다. 레포 파일 읽기·수정·생성, git 커밋·푸시, 스키마·코드 구현, 구조 판단은 사용자 로컬 Windows + pwsh 7.6.x 환경의 advisor에게 위임한다.

## 세션 종료 신호 감지 기준
다음 중 하나라도 해당되면 세션 마무리로 판단:
- "오래됐거나 업데이트할 것", "맥락 정리", "세션 마무리" 등 명시적 표현
- "여기까지", "오늘 정리" 등 마무리 발언
- /compact 이후 후속 업데이트 요청

## 표준 실행 순서 (반드시 이 순서를 따른다)

### 1단계: Advisor 위임 (구조 판단)
구조·스키마·아키텍처·방향 불확실성이 있으면 구현 전 advisor 먼저 위임한다. advisor에게 위임하여 다음을 파악한다:
- 이번 세션에서 새로 발생한 사실·결정·변화
- 업데이트가 필요한 기존 문서 목록
- 새로 생성해야 할 문서

### 2단계: JSON 업데이트 목록 수신
advisor가 다음 형식으로 응답한다:
```json
[
  {"file": "상대경로", "action": "update|create", "summary": "변경 내용 한 줄"},
  ...
]
```

### 2.5단계: 신규 인물 체크
1단계 분석 중 대화에서 언급된 고유 이름(사람)을 추출한다.
- advisor가 `data/people/{이름}/index.md` 존재 여부를 확인
- 파일이 없으면 3단계 실행 전에 사용자에게 1줄 질문:
  > "이림님 프로필이 없어요 — 역할과 관계 알려주시면 생성할게요."
- 사용자가 "나중에", "넘어가" 등으로 건너뛰면 즉시 3단계 진행

### 3단계: 병렬 에이전트 분배
JSON 목록 크기에 따라 에이전트 수를 조정하여 병렬 실행한다. claw의 codex 엔진은 `multi_agent = true`가 활성화되어 있으므로 내부 sub-agent 분기로 처리하거나, 사용자 로컬 환경에서 별도 codex 세션을 spawn한다.
- **목록 0개**: 커밋 없이 "업데이트할 내용이 없습니다." 한 줄로 종료
- **목록 1~2개**: 에이전트 2개로 분배 (과도한 분산 방지)
- **목록 3개 이상**: 에이전트 4개로 균등 분배 (codex `multi_agent` 또는 병렬 pwsh 세션)
- 에이전트당 독립적인 파일 집합 처리
- 상호 의존이 있는 파일은 같은 에이전트에 묶음

### 4단계: 2사이클 검증
1사이클: 각 에이전트 결과물 검토 — 누락·오기·일관성 확인
2사이클: 전체 문서 간 교차 참조 일관성 확인

### 5단계: 커밋 & 푸시
- yeojin-context-hub repo에 변경 사항 커밋
- 커밋 메시지 형식: `docs: YYYY-MM-DD 세션 맥락 업데이트` (날짜 자동 삽입)
- 첫 push 전 `gh auth setup-git`을 실행한다.
- `git remote get-url origin`으로 remote를 확인하고, SSH URL이면 `git remote set-url origin https://github.com/<owner>/<repo>`로 HTTPS에 고정한다.
- Git remote는 HTTPS 고정 (`https://github.com/<owner>/<repo>`). 푸시는 `scripts/git-push.ps1 -Rebase` 사용 권장 (`$env:GH_TOKEN` 자동 로드).
- 실패 시 `-f`, `--no-verify`, `--no-gpg-sign`로 강행하지 말고 실패 내용을 보고한다.
- **커밋 제외 대상**: NSSM `LocalSystem` 프로필 하위 외부 메모리 (`C:\WINDOWS\system32\config\systemprofile\` 아래 codex/claw 상태 파일) — claw 내부 메모리이므로 repo에 포함하지 않는다

### 6단계: 실행/dry-run 검증 및 최종 보고
- 구현·수정 완료 후 관련 명령으로 실행 또는 dry-run 검증을 직접 수행한다.
- 반복 가능한 스크립트·워크플로우를 새로 구현했으면 관련 skill에 패턴 추가를 먼저 제안한다.
- Discord 최종 보고는 다음 3단 구조로 간결하게 작성한다:
  1. **구현 내용**
  2. **검증 결과**
  3. **다음 단계**
- 파일 또는 URL 산출물이 있으면 마지막 줄에 `__CLAW_ARTIFACT__ {"kind":"file","path":"...","caption":"..."}` 또는 `__CLAW_ARTIFACT__ {"kind":"url","url":"...","caption":"..."}`를 붙인다.

## 자동 제안 원칙
세션 종료 신호 감지 시 사용자가 명시적으로 요청하지 않아도:
> "세션 마무리 플로우 실행할까요? (Advisor → 병렬 업데이트 → 검증 → 커밋)"

형식으로 1줄 자동 제안한다. "응", "예", "응 해줘" 등 긍정 응답 시 즉시 실행.

## 외부 메모리 커밋 제외 규칙
- claw의 memory 파일(`MEMORY.md`, memory dir 내 `*.md`)과 NSSM LocalSystem 프로필(`C:\WINDOWS\system32\config\systemprofile\...`) 하위 codex/claw 상태 파일은 claw 내부 상태
- yeojin-context-hub repo 커밋에 포함하면 안 됨
- 실수로 staging 됐을 경우 `git reset HEAD <path>`로 제외 후 커밋

## Windows/pwsh 실행 규칙

세션 마무리 플로우의 모든 명령은 Windows 11 + PowerShell 7.6.x 기준으로 작성한다.

- 환경변수는 `$env:VAR`
- 줄 연속은 백틱(`)
- 오류 리다이렉트는 `2>$null`
- 명령 체이닝은 `&&` / `||`
- 홈 경로는 `$env:USERPROFILE` 또는 절대경로 `C:\Users\yeoul\...`
- bash 어휘(`$VAR`, `/dev/null`, `~/`, 백슬래시 줄 연속) 금지

## 이메일/일정 출력 규칙

- 이메일 초안 마지막 줄에는 반드시 `발송할까요? (ㄱㄱ / 수정 요청)`을 포함한다.
- 디스커버리 콜·미팅 초대·인터뷰 등 일정 조율 이메일 발송 완료 후에는 `통화/미팅 시간 확정 시 캘린더 일정도 바로 만들어드릴 수 있습니다`를 안내한다.
