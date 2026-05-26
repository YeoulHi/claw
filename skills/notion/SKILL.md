---
name: notion
description: Notion CLI(ntn)를 사용해 페이지 조회·생성·수정, DB 쿼리, API 직접 호출 등 Notion 작업 수행
triggers:
  - 노션
  - Notion
  - 노션 페이지
  - 노션 DB
  - 노션 데이터베이스
  - 노션에 추가
  - 노션에서 가져와
  - 노션 정리
  - 노션 업데이트
  - notion page
  - notion database
---

# Notion CLI (ntn) 사용 지침

## 적용 경계

claw는 Notion 조회, 간단한 페이지 생성·수정, DB 쿼리, API 호출, 결과 요약을 처리한다.

다음이 포함되면 advisor에게 먼저 위임한다.

- Notion 데이터를 yeojin-context-hub repo 파일, 티켓, 프로젝트 구조와 동기화해야 하는 경우
- Notion DB 스키마, 속성 구조, relation/rollup 설계를 결정해야 하는 경우
- "어떤 구조가 좋을까", "DB를 어떻게 나눌까"처럼 방향이 불확실한 경우
- Notion 작업 결과를 git commit/push 대상 문서로 남겨야 하는 경우

고지 문구는 한 줄로 끝낸다.

> "→ Notion DB/문서 구조 결정이 필요해 advisor에게 위임했습니다."

## 환경 전제

claw 서비스는 Windows + NSSM `LocalSystem` 환경에서 codex(GPT-5.5) 엔진을 통해 동작한다. PowerShell 7.6.x 기준으로 명령을 작성한다.

- 환경변수: `$env:NOTION_API_TOKEN`
- 홈 경로: `$env:USERPROFILE`
- 리다이렉트: `2>$null`
- 체이닝: `&&`, `||`
- bash 문법(`$VAR`, `/dev/null`, `~/`, 역슬래시 줄 연속)은 사용하지 않는다.

## 바이너리 탐색

PATH에 등록된 경우 `ntn`을 그대로 호출한다. 없으면 다음 순서로 확인한다.

```powershell
Get-Command ntn -ErrorAction SilentlyContinue
Test-Path "$env:USERPROFILE\scoop\shims\ntn.exe"
Test-Path "$env:APPDATA\npm\ntn.cmd"
Test-Path "$env:USERPROFILE\.local\bin\ntn.exe"
```

설치되어 있지 않으면 배포 채널을 확인한 뒤 설치 안내만 한다. 임의 경로를 추정하지 않는다.

## 인증

`NOTION_API_TOKEN`은 claw 프로세스 환경변수(NSSM `AppEnvironmentExtra` 또는 `.env`)에 설정된 값을 사용한다.

```powershell
$env:NOTION_API_TOKEN
```

- NSSM `LocalSystem` 환경에서는 브라우저 기반 `ntn login`을 기본 사용하지 않는다.
- 토큰 갱신 후에는 필요 시 `Restart-Service claw`가 필요하다.
- 토큰 값은 출력하지 않는다. 존재 여부만 보고한다.

## 주요 명령어

### 페이지 조회

```powershell
ntn pages get <page-id>
ntn pages get <page-id> --json
```

### 페이지 생성

```powershell
ntn pages create --content '# 제목`n`n본문'
ntn pages create --parent page:<parent-id> < page.md
ntn pages create --parent database:<db-id> --content '...'
ntn pages create --parent data-source:<ds-id> < page.md
```

### 페이지 수정

```powershell
ntn pages update <page-id> --content '# 수정된 내용'
ntn pages update <page-id> < updated.md
```

### 데이터소스(DB) 쿼리

```powershell
ntn datasources query <data-source-id>
ntn datasources query <data-source-id> --limit 50 --json
ntn datasources query <id> --filter '{"property":"Done","checkbox":{"equals":true}}'
ntn datasources resolve <database-id>
```

### API 직접 호출

```powershell
ntn api v1/users
ntn api v1/pages/<id>
ntn api v1/databases/<id>/query -X POST
ntn api v1/pages parent[page_id]=<id> properties[title][title][0][text][content]="제목"
```

### 파일 업로드

```powershell
ntn files create < photo.png
ntn files create --external-url <url>
ntn files list
```

## ID 형식

Notion URL의 마지막 32자리 hex 문자열을 ID로 사용한다. 하이픈 포함 형식도 허용한다.

## Discord 출력 계약

- 조회 결과는 핵심만 간결히 요약한다.
- 생성·수정 결과에는 page URL 또는 page ID를 포함한다.
- 파일이나 URL 산출물이 있으면 마지막 줄에 artifact JSON을 붙인다.
- 미팅·디스커버리 콜·인터뷰 일정을 잡는 Notion/메일 연계 작업 후에는 반드시 "통화/미팅 시간 확정 시 캘린더 일정도 바로 만들어드릴 수 있습니다"를 안내한다.
- 이메일 초안을 함께 작성했다면 마지막 줄은 반드시 `발송할까요? (ㄱㄱ / 수정 요청)`으로 끝낸다.

## 검증과 반복 패턴

작업 전후로 가능한 dry-run 또는 상태 확인을 수행한다.

```powershell
Get-Command ntn -ErrorAction SilentlyContinue
if ($env:NOTION_API_TOKEN) { "NOTION_API_TOKEN: present" } else { "NOTION_API_TOKEN: missing" }
ntn pages get <page-id> --json
```

반복 가능한 Notion 동기화 스크립트, DB 쿼리 템플릿, 페이지 생성 워크플로우를 새로 만들었다면 관련 skill에 패턴 추가를 먼저 제안한다.

## 3-cycle 점검 루프

1. **Cycle 1 — 경계 확인**: 단순 Notion 작업인지, DB/문서 구조 판단으로 advisor가 필요한지 판정한다.
2. **Cycle 2 — 실행 검증**: 토큰, CLI 경로, ID 형식, data-source ID 여부를 확인한다.
3. **Cycle 3 — 결과 검증**: 생성·수정 결과를 재조회하고 Discord 출력 계약을 만족하는지 확인한다.
