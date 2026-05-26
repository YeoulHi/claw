# claw GPT-5.5 + Windows 정합화 eval 루브릭

> 4 agent 산출물(A: AGENTS.md, B: prompt.ts, C: 비즈니스 skills 5개, D: 시스템 skills 11개)의 정합성 채점 기준.
> SSOT: `claw/docs/gpt55-windows-mapping.md` 의 9번 invariant.

---

## 채점 방식

각 산출물(파일 단위)을 6개 invariant로 평가. 총 10점 만점.

| Invariant | 만점 | 평가 방법 |
|---|---|---|
| I1. macOS 명령어 잔재 | 2 | `launchctl`, `lsof`, `kill -9`, `/Users/`, `~/`(절대경로 위치), `gui/<uid>/` 등 잔존 검사 |
| I2. pwsh 어휘 정합 | 2 | `$env:VAR` (vs `$VAR`), 백틱 줄 연속(vs `\`), `&&`/`\|\|` OK, `2>$null` |
| I3. codex 어휘 정합 | 2 | `--sandbox danger-full-access`(vs `--dangerously-skip-permissions`), `gpt-5.5`(vs `claude-*`), `codex exec`(vs `claude --print`) |
| I4. NSSM 재시작 정본 | 2 | `Restart-Service claw` 또는 `__CLAW_RESTART__` 마커 → `process.exit(0)` 명시. `launchctl kickstart` 완전 제거 |
| I5. Git HTTPS + gh setup | 1 | HTTPS remote 가정, `gh auth setup-git` idempotent 안내 (해당 시) |
| I6. codex 고유 기능 가이드 | 1 | `web_search`, `multi_agent`, `node_repl`, plugins 활용 안내 (해당 시) |

### 점수 → 합격 기준

- **9~10**: PASS (cycle 종료)
- **7~8**: MINOR FIX (다음 cycle에서 미세 보완)
- **0~6**: MAJOR FIX (다음 cycle에서 재위임)

---

## 검증 방법 — 자동 grep 체크

### I1. macOS 잔재 grep

```powershell
$macosTerms = @('launchctl', '^lsof', 'kill -9', '/Users/', 'gui/<uid>', 'launchd')
foreach ($t in $macosTerms) {
  rg --no-heading -n $t <target-file>
}
```

기대값: 모든 검색이 0건.

### I2. pwsh 어휘 체크

부정 패턴 (있으면 감점):
- `\$[A-Z_]+` 단독 사용 (PowerShell이면 `$env:VAR` 형식이어야 함) — 단, 문서 내 일반 변수 설명은 예외
- `^\\\s` 줄 끝 백슬래시 (bash 줄 연속)
- `2>/dev/null` (pwsh는 `2>$null`)

### I3. codex 어휘 체크

부정 패턴:
- `--dangerously-skip-permissions` — 0건이어야 함
- `claude-haiku-`, `claude-sonnet-`, `claude-opus-` (claw skill 본문) — 0건이어야 함
- `claude --print` — 0건이어야 함

### I4. NSSM 정본 체크

부정 패턴 (있으면 0점):
- `launchctl kickstart` 잔재
- `com\.claw` (macOS launchd plist 잔재)

긍정 패턴 (있어야 점수):
- `Restart-Service claw` 또는 `__CLAW_RESTART__` 또는 `NSSM`

### I5. Git HTTPS 체크

긍정 패턴 (해당 skill에 git 명령 등장 시):
- `https://github.com/`
- `gh auth setup-git`

부정:
- `git@github.com:` (SSH URL — DUWLS LocalSystem에서 불가)

### I6. codex 고유 기능 체크

긍정 패턴 (해당 시):
- `web_search`, `multi_agent`, `node_repl`, `documents`, `spreadsheets`, `presentations`

---

## 3사이클 진행 절차

### Cycle 1 — 1차 채점

1. 4 agent가 자체 검증 완료한 결과를 받음
2. 각 산출물에 대해 위 자동 grep + 수동 확인
3. 점수표 생성:
   ```
   | 파일 | I1 | I2 | I3 | I4 | I5 | I6 | 합계 |
   ```
4. PASS / MINOR FIX / MAJOR FIX 분류
5. 사용자에게 cycle 1 결과 보고

### Cycle 2 — 미달 항목 재위임

1. MINOR / MAJOR로 분류된 산출물에 대해 SendMessage로 같은 agent에게 재작업 요청 (감점 항목 명시)
2. 재작업 결과 재채점
3. 사용자에게 cycle 2 결과 보고

### Cycle 3 — 최종 정합

1. 여전히 미달인 항목 (있다면) 메인 agent가 직접 수정
2. 전체 재채점
3. 사용자에게 cycle 3 최종 결과 보고
4. PASS 100% 도달 시 빌드 + 재시작 + 커밋
