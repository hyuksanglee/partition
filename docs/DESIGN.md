# Partition 설계

> 2026-10-29. 코드 쓰기 전 합의용. 근거·확인된 사실은 `HANDOFF.md` 참고.
> ⚠️ 표시는 아직 확인 안 된 것.

## 1. 기술 선택 (확정)

- JavaScript ESM(`.mjs`) + `jsconfig.json`(`checkJs`)으로 JSDoc 타입 검사
- 외부 런타임 패키지 없음. Node 기본 기능만. 개발용으로만 `typescript`(타입 검사)
- 테스트: `node --test`
- 빌드 없음. 저장소 그대로 실행

## 2. 폴더 구조

```
.claude-plugin/
  plugin.json            이름·버전·설명
  marketplace.json       "source": "." → 저장소 = 마켓플레이스 겸 플러그인
hooks/
  hooks.json             SessionStart · UserPromptSubmit · PreToolUse → src/claude/hook.mjs
skills/
  setup/SKILL.md         settings.json 변경 계획을 보여주고 승인받기
  ui/ status/ budget/    hook이 못 가로챌 때의 대비용(CLI 실행) ⚠️
src/
  core/                  순수 계산. 파일·시간·환경변수 직접 접근 없음 → 테스트 쉬움
    stages.mjs           사용량·예산 → ok / warn / wrap / block
    attribute.mjs        오른 %p를 대기분 토큰 비중대로 프로젝트에 배분
    allocation.mjs       할당 합계, 설정 가능 범위(100 − 다른 프로젝트), 검증
    window.mjs           창 리셋 감지(resets_at 변화)
  store/                 ~/.partition 읽기·쓰기
    paths.mjs            경로 (PARTITION_HOME으로 바꿀 수 있게: 테스트용)
    file.mjs             잠금 + 원자적 쓰기(임시 파일 → rename)
    config.mjs           config.json 기본값·읽기·쓰기
    state.mjs            state.json 기본값·읽기·쓰기
  claude/                Claude Code 연결부 (Codex는 나중에 codex/ 로 추가)
    statusline.mjs       status line 진입점: 입력 저장 → 배분 → 한 줄 출력, 기존 status line 감싸기
    hook.mjs             hook 진입점: 이벤트별 분기, 명령 가로채기, 오류 시 통과
    transcript.mjs       기록 파일 증분 읽기, message id 중복 제거, 처음 보는 파일은 최근 10분만
    settings.mjs         ~/.claude/settings.json 변경 계획·적용·원복
    launcher.mjs         ~/.partition/statusline.mjs 실행기 내용 생성
  commands/              CLI·hook·GUI가 공유하는 기능. 결과는 {text, data}
    status.mjs  budget.mjs  rules.mjs  setup.mjs  uninstall.mjs  ui.mjs
  ui/
    server.mjs           127.0.0.1 전용, 무작위 토큰, Host 검사, 창 닫히면 종료
    window.mjs           macOS JXA 창 → Chrome 앱 모드 → 기본 브라우저
    page/                index.html · app.js · style.css (빌드 없음)
  project.mjs            프로젝트 판별: git 최상위, 아니면 cwd
  messages.mjs           사용자에게 보이는 문구(ko/en)
  cli.mjs                터미널용: partition status | budget | rules | ui | setup | uninstall
test/                    src 구조 그대로 (test/core/stages.test.mjs …)
docs/  README.md  README.ko.md  LICENSE  CONTRIBUTING.md
```

의존 방향: `core` ← `store` ← `commands` ← `claude/`·`ui/`·`cli.mjs`. core는 아무것도 import하지 않는다.

## 3. 데이터 (`~/.partition/`)

```jsonc
// config.json — 사용자가 정하는 것
{
  "version": 1,
  "budgets": { "/Users/me/Project/A": { "fiveHour": 30, "sevenDay": 20 } },  // %p, 없으면 제한 없음
  "rules": { "warnAt": 0.8, "wrapMarginPp": 3, "block": true },
  "weights": { "input": 1, "cacheWrite": 1.25, "cacheRead": 0.1, "output": 5 }  // 가정, README 명시
}

// state.json — Partition이 기록하는 것
{
  "version": 1,
  "lastStatusLineAt": 0,                    // 연결 확인용(ms)
  "windows": {
    "fiveHour": { "resetsAt": 0, "lastUsedPct": 0,
                  "byProject": { "<project>": 0 }, "unattributed": 0, "beforeTracking": 0,
                  "pending": { "<project>": 0 },   // 창마다 따로: 5시간·주간이 오르는 시점이 달라서
                  "notified": { "<project>": "warn" } },
    "sevenDay": { … }
  },
  "transcripts": { "<path>": { "offset": 0, "seen": { "<message id>": 0 }, "touchedAt": 0 } }
}

// install.json — 설치 정보
{ "pluginRoot": "…", "installed": true, "originalStatusLine": { … } | null }
```

## 4. 흐름

**status line (응답마다)**
1. stdin JSON 읽기 → `rate_limits` 없으면 기존 status line만 출력하고 끝(fail-open)
2. 잠금 → state 읽기 → 창 리셋이면 그 창 초기화
3. 이 세션 기록 파일의 새 줄을 읽어 프로젝트 대기분에 더함
4. 사용률이 올랐으면 오른 %p를 대기분 비중대로 배분, 대기분 비우기. 대기분 없으면 미귀속
5. 저장 → `[A 12/30%p · 5h 41%]` + 기존 status line 출력

**UserPromptSubmit**
1. `/partition:<명령>`이면 명령 실행 → 결과를 reason에 담아 block(토큰 0)
2. 프로젝트 단계 판정: warn(1회 안내) · wrap(`additionalContext`로 마무리 지시) · block(`decision: block`)
3. 값 없음·리셋·오류 → 통과

**PreToolUse**: block 단계 + `rules.block`이면 deny. Partition 자신의 명령은 통과.

**SessionStart**: `pluginRoot` 기록, status line 미연결이면 setup 안내.

## 5. 정한 것 (2026-10-29)

1. **Node 최소 버전** — 18 이상. Claude Code를 native installer로 설치한 사용자에게 `node`가 있는지 ⚠️
2. **윈도우 지원** — v1은 macOS·Linux, 윈도우는 경로 처리만 미리 대비
3. **메시지 언어** — 시스템 언어(LANG) 따라 ko/en, 설정으로 고정 가능
4. **명령 대비 skill** — 대화형 모드에서 hook이 슬래시 명령을 먼저 받는지 ⚠️. 못 받으면 skill이 CLI를 실행(토큰 조금 씀)
5. **status line 표시 형식** — `[A 12/30%p · 5h 41%]`, 주간 예산이 있으면 `· 7d 3/20%p` 추가
