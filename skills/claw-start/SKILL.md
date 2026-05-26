---
name: claw-start
description: 데스크탑(DUWLS) claw 서버 시작/상태 확인 명령을 Windows pwsh 기준으로 안내
triggers:
  - claw 시작
  - claw start
  - claw 켜줘
  - claw 실행
  - claw 서비스 시작
---

# Claw 시작 안내

## 3-Cycle 점검 기준

- Cycle 1: 사용자가 원하는 것이 단순 시작 명령 안내인지, 레포 파일 수정/서비스 설정 변경인지 구분한다.
- Cycle 2: 명령은 PowerShell 7.6.x 기준으로 제시한다. bash 어휘(`~/`, `$VAR`, `/dev/null`, `\` 줄 연속)는 쓰지 않는다.
- Cycle 3: 시작 후 확인할 서비스/포트/버전 검증 명령을 함께 제공한다.

## 역할 경계

- claw는 명령 안내와 간단한 상태 설명까지만 한다.
- NSSM 설정 변경, `claw` 레포 수정, 빌드, 커밋/푸시는 advisor에게 위임한다.
- 사용자가 "설정 바꿔줘", "고쳐줘", "서비스 등록해줘"라고 하면 즉시 advisor에게 위임한다.

고지 예시:

> → claw 서비스 설정 변경이 필요해 advisor에게 위임했습니다.

## 권장 시작 방식

운영 환경에서는 NSSM 서비스를 사용한다.

```powershell
Start-Service claw
Get-Service claw | Select-Object Status, StartType
Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue
```

서비스가 이미 떠 있으면 재시작한다.

```powershell
Restart-Service claw
Get-Service claw | Select-Object Status, StartType
Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue
```

## 수동 실행이 필요한 경우

개발/임시 확인 용도에서만 사용한다. 운영 반영은 NSSM 서비스 기준이다.

```powershell
Set-Location 'C:\yeojin-context-hub\claw'
node dist/server.js
```

## 검증 명령

```powershell
codex --version
node --version
Get-Service claw | Select-Object Status, StartType
Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue
```

## Discord 응답 형식

명령만 던지지 말고, 사용자가 바로 붙여넣을 수 있게 짧게 안내한다.

```text
터미널에 붙여넣으세요:

```powershell
Start-Service claw
Get-Service claw | Select-Object Status, StartType
Get-NetTCPConnection -LocalPort 3200 -ErrorAction SilentlyContinue
```
```

파일이나 URL 산출물을 만들었을 때만 artifact JSON을 마지막 줄에 붙인다.
