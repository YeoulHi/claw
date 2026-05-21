---
id: "0003"
title: result.yaml 포맷 확정 + SDK 집계 초안
type: one-off
cluster: infra
status: backlog
eval: ~
created: 2026-05-21
---

## 목표

eval 실행 결과를 `result.yaml`로 ticket 폴더에 병치 저장하고,
SDK로 전체 티켓 결과를 집계할 수 있는 기반을 만든다.

## 발현 맥락

advisor 논의(2026-05-21) → evals/ 에 기준만 있고 실행 결과 저장 방식이 없음.
result.yaml을 ticket 병치로 두면 SDK가 `tickets/*.result.yaml` glob 한 번으로 전체 통계 집계 가능.

## result.yaml 표준 포맷

```yaml
ticket: "NNNN"
eval: skill-authoring          # 적용된 eval id
verdict: APPROVED | CHANGES_REQUESTED | CONDITIONAL_APPROVED
timestamp: 2026-05-21T10:00:00
items:
  - id: "check-frontmatter"
    status: PASS | FAIL | SKIP
    note: ""
```

## 작업 범위

1. result.yaml 포맷 확정 (위 포맷 기준)
2. 0001 eval 결과를 `tickets/0001-eval-review-infra.result.yaml`로 소급 작성
3. SDK 집계 스크립트 초안: `tickets/*.result.yaml`을 glob해 verdict별 카운트 출력

## SDK 집계 스크립트 예시 (참고)

```typescript
// scripts/aggregate-results.ts
import { glob } from 'glob';
import { parse } from 'yaml';
import { readFileSync } from 'fs';

const files = await glob('tickets/*.result.yaml');
const results = files.map(f => parse(readFileSync(f, 'utf-8')));
const summary = results.reduce((acc, r) => {
  acc[r.verdict] = (acc[r.verdict] || 0) + 1;
  return acc;
}, {});
console.log(summary);
```

## 선행 조건

0002 완료 (스키마 확정 후 result 포맷 작성)
