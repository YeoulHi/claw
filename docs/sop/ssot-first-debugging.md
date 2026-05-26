---
author_id: yeojin
created_at: 2026-05-26T00:00:00+09:00
status: completed
project: claw
project_docs_id: sop-ssot-first-debugging
---

# SSOT-first 디버깅 SOP

외부 CLI(codex 등)의 argv·스키마·동작은 **절대 추측하지 않는다**. 공식 spec을 먼저 확보해 SSOT 문서로 박아두고, 그 SSOT와 1:1 매핑되도록 코드를 정렬한다. 오늘 3건의 사건(#4, #5, #7)이 모두 "spec 없이 추측"으로 발생했다.

---

## 사건 ↔ 조항 매핑

| 사건 | 증상 | 근본 원인 | cover 조항 |
|---|---|---|---|
| **#4** | `codex` 호출 시 `unexpected argument '--session-id' found` → exit 2 | 공식 `codex --help`에 없는 옵션을 claw가 가정 사용 | §1 추측 금지 / §2 Step 1·3 / §4 Q1 |
| **#5** | `codex exec resume` 호출 시 또 exit 2 — `--sandbox` 거부 | subcommand별 옵션 차이를 `<cmd> --help` 단위로 확인하지 않음 | §2 Step 1·3 / §4 Q2 / §5 반례 |
| **#7** | session_id 파싱 실패 → `crypto.randomUUID()`로 가짜 UUID 생성 후 DB 적재 → 다음 resume에서 "no rollout found" 영구 깨짐 | silent fallback이 가짜 값을 영속 저장소로 흘려보냄 | §3 fallback 함정 / §4 Q3 |

---

## 1. 원칙 — 추측 금지, 공식 spec 우선

- **추측한 인자·이벤트·옵션·스키마는 코드에 넣지 않는다.** "아마 있을 것 같다"는 가설이다. 검증되지 않은 가설을 코드에 박아두는 순간 그것은 거짓말이다.
- **외부 의존성은 모두 spec 문서가 선행한다.** 코드보다 spec이 먼저, spec보다 공식 출처가 먼저.
- **수정의 단위는 "spec과 코드의 정렬"이지 "에러가 사라질 때까지 옵션 바꾸기"가 아니다.** 추측 patch loop는 즉시 중단.

---

## 2. 4단계 SSOT 절차

### Step 1 — 공식 spec 확보

다음 3개를 모두 수집한다. 하나라도 빠지면 다음 단계로 가지 않는다.

- [ ] **`<cli> --help` 전체 텍스트** — subcommand가 있으면 `<cli> <sub> --help`까지 각각
- [ ] **공식 GitHub repo README / docs** — 버전 태그·릴리즈 노트 포함
- [ ] **실측 1회 — 가장 단순한 invocation으로 실제 JSON 이벤트 출력 1건 확보** (스키마 검증용)

### Step 2 — `claw/docs/<cli>-spec.md` 작성

SSOT 문서로 박는다. 포함 필수 항목:

- CLI 이름·확인한 **버전 번호**·확인 일자
- subcommand별 옵션 표 (옵션명·타입·기본값·subcommand에서만 유효한지 표기)
- 이벤트/응답 JSON 스키마 (key·타입·생략 가능 여부)
- 실측 출력 샘플 1건 이상 (raw 그대로)

좋은 예: [`claw/docs/codex-cli-spec.md`](../codex-cli-spec.md)

### Step 3 — 코드의 가정 ↔ spec 1:1 매핑 점검

- 코드에서 외부 CLI를 호출하는 모든 지점을 grep → spec과 줄 단위로 대조
- 불일치 1건이라도 발견되면 **코드를 spec에 맞춰 정정** (반대로 spec을 코드에 맞추지 않는다 — spec은 외부 사실)
- 매핑 표를 PR 설명 또는 ticket에 남긴다

### Step 4 — spec 변경 감지 체크리스트

CLI 버전 업데이트·`npm update`·외부 의존성 갱신 시 자동으로 트리거:

- [ ] 새 버전의 `--help` 텍스트를 기존 spec 파일과 diff
- [ ] CHANGELOG / 릴리즈 노트에서 breaking change 확인
- [ ] 다시 Step 1~3 반복

---

## 3. fallback 함정 — silent 가짜값의 영구 영향

> **사건 #7 cover**: codex 응답에서 session_id 파싱이 실패하자 `crypto.randomUUID()`로 가짜 UUID를 만들어 DB에 적재했다. 다음 resume 호출이 그 가짜 UUID로 rollout을 찾으려다 "no rollout found"로 영구 실패했다.

### 왜 위험한가

fallback은 보통 "그냥 기본값 넣고 진행"으로 작성된다. 하지만 그 fallback 값이 **영속 저장소(DB·파일·세션)에 적재**되는 순간, 후속 호출들이 그 가짜 값을 진짜로 믿고 동작한다. 한 번의 silent fallback이 시스템 상태를 영구 오염시킨다.

### 권장 패턴

1. **명시적 실패 + 로그** (default 권장)
   - 외부 spec이 보장하는 값이 없으면 즉시 throw / Result.Err. 로그에 "spec violation: expected X, got Y" 명시.
2. **불가피한 fallback은 marker로 표시**
   - 가짜 값을 쓰더라도 `is_synthetic: true` 같은 marker를 함께 저장.
   - 후속 호출은 marker를 보고 **그 값을 재사용하지 않고 새 세션을 강제**.
3. **silent fallback 금지**
   - `?? randomUUID()`, `|| "default"`, `catch { return null }` 같은 패턴이 영속 데이터 경로에 들어가는지 grep으로 정기 점검.

### 사건 #7에 적용했어야 할 형태

```ts
// BAD — 사건 #7 패턴
const sessionId = parseSessionId(response) ?? crypto.randomUUID();
await db.save({ sessionId });

// GOOD — 명시적 실패
const sessionId = parseSessionId(response);
if (!sessionId) {
  throw new Error("codex response missing session_id — spec violation");
}
await db.save({ sessionId });
```

---

## 4. 자기 진단 질문 4개

코드 작성·리뷰 시 매번 자문한다. 4개 모두 "예"여야 통과.

1. **Q1 — 출처**: 이 인자/이벤트/옵션이 공식 docs에 있는가? **정확히 어느 문서 어느 줄인지** 댈 수 있는가?
2. **Q2 — subcommand 분기**: 이 옵션이 subcommand별로 다를 가능성은? **`<cmd> <sub> --help`로 따로 확인**했는가?
3. **Q3 — fallback 검사**: 이 코드의 fallback이 silent하게 가짜 값을 만들어 **영속 저장소에 흘려보내고** 있지는 않은가?
4. **Q4 — 버전 의존**: 다음 CLI/SDK 업데이트 시 깨질 수 있는가? **CHANGELOG·릴리즈 노트를 확인**했는가?

---

## 5. 반례 — 오늘 세션 추측 patch loop

다음은 **하지 말아야 할 패턴**의 실제 기록:

| 단계 | 추측 | 결과 |
|---|---|---|
| 1 | "아마 `--session-id` 옵션 있을 거야" → 옵션 추가 | 사건 #4: `unexpected argument '--session-id' found`, exit 2 |
| 2 | "resume도 `--sandbox` 받을 거야" → 그대로 사용 | 사건 #5: resume에는 `--sandbox` 없음, 또 exit 2 |
| 3 | "session id 없으면 그냥 랜덤 UUID 넣으면 되겠지" → `crypto.randomUUID()` fallback | 사건 #7: 가짜 UUID가 DB에 적재되어 후속 resume이 영구 실패 |

**공통 패턴**: 세 사건 모두 "spec 확인 1번"이면 30초 안에 막혔다. 추측 patch loop가 만들어낸 시간 손실은 누적 수시간.

**교훈**: 에러가 나오면 옵션을 바꾸지 말고 **`--help`를 먼저 읽어라**. fallback을 추가하지 말고 **명시적으로 실패시켜라**.

---

## 6. 참조 SSOT

- [`claw/docs/codex-cli-spec.md`](../codex-cli-spec.md) — codex CLI SSOT (이 SOP를 따라 작성된 예시)
- [`claw/docs/gpt55-windows-mapping.md`](../gpt55-windows-mapping.md) — 환경 매핑 SSOT
