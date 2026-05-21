---
name: window-powershell-issue-writer
description: Windows PowerShell 7.6.x 이슈를 notes/windows-ps76-issues.md에 기록
triggers:
  - PS 이슈 기록
  - PowerShell 이슈 로그에 추가
  - PS 버그 기록해줘
  - 이슈 로그에 추가해줘
  - windows-ps76-issues에 추가
  - PowerShell 이슈 추가해줘
  - PS 오류 기록
---

# Windows PowerShell 이슈 기록 지침

유저가 PowerShell 이슈를 로그에 기록해달라고 요청하면 아래 절차를 따른다.

## 대상 파일

`claw/notes/windows-ps76-issues.md`

## 기록 포맷

```
### [YYYY-MM-DD] 제목

**증상:** 어떤 명령어/상황에서 어떤 오류가 났는지
**원인:** 왜 발생했는지
**해결책:** 검증된 대응 방법
**참고:** 관련 커밋/문서 (없으면 생략)
```

## 절차

1. 유저가 제공한 정보를 위 포맷으로 정리한다
2. advisor에게 위임: `## 기록된 이슈` 섹션 마지막 항목 뒤에 append
3. 해결책이 미검증이면 `## 추가 예정 (미검증)` 섹션에 추가

## 원칙

- 검증된 해결책만 `## 기록된 이슈`에 기록 (추측 금지)
- 기존 항목 편집 금지 — append only
- 이슈 해결은 이 skill의 범위 밖 — 기록만 한다
