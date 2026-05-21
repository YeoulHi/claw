# Windows PowerShell 7.6.x 이슈 로그

> claw가 Windows NSSM 서비스(NT AUTHORITY\SYSTEM)로 실행될 때 발생하는
> PowerShell/Windows 환경 특유의 이슈를 누적 기록한다.
> 검증된 해결책만 기록 (추측 금지).

---

## 이슈 포맷

```
### [YYYY-MM-DD] 제목
**증상:** 어떤 명령어/상황에서 어떤 오류가 났는지
**원인:** 왜 발생했는지
**해결책:** 검증된 대응 방법
**참고:** 관련 커밋/문서
```

---

## 기록된 이슈

### [2026-05-21] `gh` (GitHub CLI) command not found

**증상:** Bash 도구로 `gh auth setup-git` 실행 시 `command not found: gh`

```
/usr/bin/bash: line 1: gh: command not found
```

**원인:** claw는 NSSM을 통해 NT AUTHORITY\SYSTEM 계정으로 실행됨.
이 계정의 PATH에 GitHub CLI(`gh`)가 포함되어 있지 않음.
추가로 Bash 도구는 WSL/Git Bash 경로를 사용하는데, 거기에도 `gh`가 없음.

**해결책:** `gh` 대신 HTTPS + GH_TOKEN 환경변수 조합으로 push.

```powershell
# PowerShell 도구에서 실행 (Bash 도구 아님)
git push origin main  # GH_TOKEN이 설정되어 있으면 HTTPS로 자동 인증됨
```

push 전 원격 URL이 HTTPS인지 확인:
```powershell
git remote get-url origin
# SSH(git@github.com:...)이면 HTTPS로 전환
git remote set-url origin https://github.com/<owner>/<repo>
```

**참고:** OPS.md "첫 push 전" 절차 항목. `gh auth setup-git`은 PowerShell 7.6.x에서 불필요 (GH_TOKEN 기반 인증으로 대체).

---

### [2026-05-21] PowerShell 2>&1 stderr redirect — NativeCommandError

**증상:** PowerShell 도구에서 `git push ... 2>&1` 실행 시 성공했음에도 오류처럼 보임

```
git : To https://github.com/...
    + CategoryInfo : NotSpecified: (...:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
```

**원인:** PowerShell 5.1/7에서 native 실행파일의 stderr를 `2>&1`로 리다이렉트하면
각 줄이 `ErrorRecord`로 래핑됨. `git push`는 진행 상황을 stderr로 출력하므로
성공해도 NativeCommandError가 발생함.

**해결책:** PowerShell 도구에서는 `2>&1` 리다이렉트 제거.
stderr는 자동 캡처되므로 별도 리다이렉트 불필요.

```powershell
# 올바른 방법
git push origin main

# 피해야 할 방법
git push origin main 2>&1  # NativeCommandError 유발
```

실제 성공 여부는 출력의 `main -> main` 라인으로 확인.

---

### [2026-05-21] PowerShell 스크립트 파일 내 한글 리터럴 인코딩 파싱 실패

**증상:** `.ps1` 스크립트 파일에 한글 문자열 리터럴 포함 시 PowerShell이 파싱 단계에서 오류 발생

```
Unexpected token 'ê°€' in expression or statement.
The string is missing the terminator: ".
```

UTF-8로 저장된 파일의 한글이 `ì¶"ê°€ ì˜ˆì •`처럼 Windows-1252로 깨져 읽힘.

**원인:** Claude Code의 Write 도구가 BOM 없는 UTF-8로 파일을 저장함.
PowerShell(SYSTEM 계정 환경)이 스크립트 파일을 시스템 기본 인코딩(Windows-1252)으로 파싱해 한글 처리 실패.

**해결책:** `.ps1` 스크립트 파일에 한글 리터럴을 사용하지 않는다.

1. 한글 문자열이 필요하면 ASCII 앵커 주석으로 대체
   ```powershell
   # 한글 섹션 헤더 대신 HTML 주석 앵커 사용
   $anchor = "<!-- ps76-pending-anchor -->"
   ```
2. 파일 내 한글은 변수로 받거나(외부 파일에서 읽기) 바이트 배열로 구성
3. 스크립트가 읽는 대상 파일(`.md` 등)은 한글 포함 가능 — 스크립트 소스코드만 ASCII-safe 유지

**참고:** commit `34e50c7` — ps-error-logger.ps1 최초 버전이 한글 리터럴로 파싱 실패, ASCII anchor 방식으로 재작성

---

<!-- ps76-pending-anchor -->
## 추가 예정 (미검증)

- Windows Defender / 바이러스 백신이 Node.js 프로세스를 일시 차단하는 케이스
- NSSM 서비스 재시작 시 포트 CLOSE_WAIT 상태 잔존
