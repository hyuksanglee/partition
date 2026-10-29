# Partition 인계 문서 (Claude Code에서 처음부터 다시 만들기용)

> 2026-10-29, Claude 앱(Claude 탭) 대화에서 정리. 이 문서만 읽고 이어서 작업할 수 있게 썼다.
> 기존 코드(`~/Project/Partition-v0`)는 참고용 v0.1 시제품이다. 새 구현은 `~/Project/Partition`(github.com/hyuksanglee/partition)에 있고 설계는 `docs/DESIGN.md`.

## 0. 작업 방식 (사용자 선호)

- 코드를 쓰기 전에 설계를 먼저 같이 정한다.
- 커밋은 Conventional Commits (feat/fix/docs …).
- 수치·성능 주장은 직접 측정한 것만 쓴다. 지어낸 수치 금지. 추정은 추정이라고 적는다.
- 확인 안 된 것을 확인된 것처럼 말하지 않는다. 틀린 가정은 바로 인정하고 고친다.
- 한국어는 짧고 자연스럽게.

## 1. 만들 것

**Partition: AI 코딩 도구의 구독 사용 한도를 프로젝트별로 나눠 쓰게 하는 오픈소스 플러그인.**
서버 메모리를 컨테이너마다 할당하듯, 5시간·주간 한도를 프로젝트마다 %p로 할당하고, 넘으면 경고 → 마무리 요청 → 차단한다.

- 해결할 문제: 여러 프로젝트를 동시에 작업하면 한 프로젝트가 한도를 다 써서 다른 프로젝트를 못 하게 된다.
- 실제 한도를 쪼개는 게 아니라, 내 컴퓨터에서 스스로 지키는 제한이다(한도는 서버가 관리).
- 1순위 대상: Claude Code (Pro/Max 구독자). Codex는 나중에.
- GitHub에 MIT 라이선스로 공개. README는 영어 원본 + 한국어.

## 2. 확인된 사실 (출처 있음)

### Claude Code (공식 문서 code.claude.com, 2026-10-29 확인)
- **status line 입력 JSON**에 `rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage`(0–100), 각 `resets_at`(epoch 초)가 들어온다. Pro/Max 구독자에게만, 세션의 첫 응답 이후부터. 같은 입력에 `session_id`, `transcript_path`, `cwd`, `workspace.project_dir`도 있다. (docs/en/statusline)
- status line은 **AI 응답이 올 때마다** 다시 실행되고 토큰을 쓰지 않는다.
- **hook에는 사용률이 들어오지 않는다.** 그래서 status line에서 받은 값을 파일에 저장해두고 hook이 읽는 구조가 필요하다.
- **플러그인은 status line을 직접 설정할 수 없다.** plugin settings에서 효과 있는 키는 `agent`, `subagentStatusLine`뿐. 사용자의 `~/.claude/settings.json`을 고쳐야 한다(→ 사용자 승인 후 고치는 setup 단계 필요). (docs/en/plugins-reference)
- 플러그인 구조: `.claude-plugin/plugin.json`(필수 키는 `name`), `hooks/hooks.json`(최상위 `"hooks"` 래퍼 필요), `skills/<이름>/SKILL.md`. `${CLAUDE_PLUGIN_ROOT}`는 업데이트 때마다 경로가 바뀐다(상태 저장 금지). 이름이 `claude-`로 시작하면 안 됨.
- `.claude-plugin/marketplace.json`에 `"source": "."`을 쓰면 저장소 하나가 마켓플레이스 겸 플러그인이 된다. 설치: `/plugin marketplace add <owner>/<repo>` → `/plugin install partition@partition`. 로컬 테스트: `claude --plugin-dir <폴더>`.
- hook 출력: `UserPromptSubmit`은 `{"decision":"block","reason":…}`로 요청 거부, `additionalContext`로 AI에게 지시 추가. `PreToolUse`는 `hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason`. 서브에이전트의 도구 호출에도 hook이 걸린다. `UserPromptSubmit` 기본 timeout 30초.
- 터미널·Claude 앱 Code 탭(로컬 세션)·VS Code는 같은 설정 파일을 읽는다 → 한 곳에서 user scope로 설치하면 모두에서 쓸 수 있다.

### 직접 실험으로 확인 (Claude Code 2.1.312, `claude -p` 모드)
- `/partition:ui` 같은 **슬래시 명령 원문이 `UserPromptSubmit` hook에 그대로 들어온다.** hook이 처리하고 block하면 AI 호출 없이 끝난다(입력·출력 토큰 0 확인). → 플러그인 명령을 토큰 0으로 만들 수 있다. 단, 화면에 "UserPromptSubmit operation blocked by hook" 문구가 붙는다.
- 예산 초과 시 `UserPromptSubmit` block → AI 호출 전에 막힘(토큰 0) 확인.
- `claude plugin validate .` 통과(README·아이콘 없음 경고만).

### Codex (사용자 Mac 기록 분석, 세션 119개)
- 세션 기록(`~/.codex/sessions/**.jsonl`)의 `token_count` 이벤트에 `rate_limits.primary`(300분)·`secondary`(10080분) `used_percent`가 정수로 남는다.
- 단계 사이 % 증가: 중앙값 1%, p90 3%, 최대 25% → 여유(마무리 지점) 기본값 3%p의 근거.
- 1%당 토큰이 모델별로 약 4만~23만(약 6배 차이) → **예산을 토큰으로 잡으면 안 되고 %로 잡아야 한다.**
- 입력 토큰의 약 97%가 캐시 읽기(매 호출마다 대화 전체를 다시 보냄).
- Codex Desktop에서 프로젝트·전체 `hooks.json` 모두 실행되지 않았다. Ponytail README에 "설치 후 `/hooks`에서 hook을 검토하고 신뢰(trust)하라"는 안내가 있어, 승인을 안 한 것이 원인일 가능성이 있다(미확인).
- 자세한 수치: `docs/usage-analysis.md`, `docs/*.xlsx`

## 3. 정한 설계

- **예산 단위**: 한 창(5시간/주간)에서 프로젝트가 쓸 수 있는 %p. 프로젝트 = git 저장소 최상위, 아니면 현재 폴더.
- **프로젝트별 배분**: status line이 실행될 때마다 그 세션 기록(`transcript_path`)에 새로 쌓인 토큰을 그 프로젝트 '대기분'에 더하고, 사용률이 오르면 오른 %p를 대기분 토큰 비중대로 나눈다.
  - 같은 응답이 여러 줄로 기록되므로 message id로 중복 제거. 처음 보는 기록 파일은 최근 10분만 센다.
  - 토큰 가중치는 API 가격 비율(입력 1, 캐시 생성 1.25, 캐시 읽기 0.1, 출력 5)을 기본값으로 — **가정**이므로 README에 명시하고 설정으로 바꿀 수 있게.
  - 대기분 없이 오른 사용률(웹·다른 기기·Claude 탭 사용 등) = '미귀속', 추적 시작 전 사용 = 'beforeTracking'으로 따로 표시.
  - 한계: 동시 세션이면 배분이 치우칠 수 있음, 서브에이전트 별도 기록 파일 미반영.
- **단계**: 예산의 80%에서 경고(1회) → 예산 3%p 앞에서 AI에게 마무리 지시 → 예산 도달 시 새 요청·도구 실행 차단. 정확히 멈출 수는 없고 단계 하나만큼 넘칠 수 있다(README에 명시). 차단은 끌 수 있게(경고+마무리만).
- **절대 막지 않는 것**: Partition 자신의 명령. 사용률 값이 없거나 창이 리셋된 경우(fail-open). hook 오류도 통과.
- **저장 위치**: `~/.partition/` (config.json 예산·규칙, state.json 사용 기록). 동시 실행 대비 잠금 + 원자적 쓰기.
- **status line 연결**: `~/.partition/statusline.mjs` 실행기를 settings.json에 등록하고, SessionStart hook이 현재 플러그인 경로를 기록 → 업데이트로 경로가 바뀌어도 동작. 기존 status line은 지우지 않고 감싸서 같이 표시. setup은 **바꿀 내용을 먼저 보여주고 승인 후 적용**, uninstall로 원복.
- **명령**: `/partition:ui`(설정 창), `/partition:status`, `/partition:budget 30 [--week]`는 hook이 먼저 실행하고 결과를 Claude에게 넘겨 보여준다(block하면 토큰 0이지만 "차단했습니다" 문구가 붙어서 2026-10-29에 바꿈). `/partition:setup`은 settings.json을 바꾸므로 Claude가 계획을 보여주고 승인받는 skill. 터미널용 CLI도 같은 기능(`node src/cli.mjs …`). CLI와 GUI는 같은 기능 모듈을 공유.
- **설정 창(GUI)** — 사용자가 원한 형태:
  - 브라우저 페이지가 아니라 **Claude 앱 설정 창처럼 작은 창**(약 640×600). macOS는 기본 WebKit으로 띄운 독립 창(osascript JXA, 설치 불필요, 사용자 Mac에서 동작 확인됨). 실패하면 Chrome 앱 모드/기본 브라우저.
  - 탭 3개: 예산 · 규칙 · 연결.
  - 예산 탭: **한도 전체(100%p)를 막대 하나로**, 프로젝트별 할당 칸 + **미할당** 칸 표시(다른 프로젝트에 30% 줬으면 보이게). 프로젝트를 고르면 **설정 가능 범위**(100 − 다른 프로젝트 할당)를 막대 아래와 숫자로 표시, 슬라이더는 그 범위 안에서만. **움직이는 동안 막대에 실시간 반영**, 손 떼면 저장.
  - **색은 Claude 앱 톤**(따뜻한 미색/짙은 회색, 클레이 강조색). 라이트/다크.
  - 로컬 서버는 127.0.0.1 전용 + 무작위 토큰 + Host 검사, 창 닫으면 종료.

## 4. 경쟁/참고

Claude Code용 같은 개념이 이미 있다(2026-10-29 검색, 모두 MIT, 스타 0~1):
- Cuota (chechesa-labs/claude-code-cuota): 폴더별 5시간·주간 상한, 상한 10%p 앞 마무리, 거의 같은 설계
- claude-quota-guard (TakalaWang): 프로젝트별 주간 %·달러 예산, 요청·도구 차단
- cc-kill-switch, cc-limit-guard: 사용자별/계정 전체 단위

차별점 목표: GUI 할당 막대, 배분 방식 투명 공개, 한국어 README, 나중에 Codex까지.
참고한 구성: Ponytail (DietrichGebert/ponytail, MIT) — README 구성, 마켓플레이스 설치 방식.

## 5. 아직 확인 못 한 것

1. Claude 앱 **Code 탭이 커스텀 status line을 실행하는지** (안 하면 Code 탭 사용량은 기록이 안 됨)
   - → **실행하지 않음(2026-10-29 확인).** settings.json에 연결하고 플러그인을 설치한 뒤 새 Code 탭 세션에서 응답을 받아도 state.json이 생기지 않았다. 공식 문서에는 이에 대한 언급이 없었다.
   - 대안: `claude -p "/usage"`가 AI 호출 없이(토큰 0, $0, num_turns 0) 5시간·주간 %와 리셋 시각을 문장으로 출력한다(1.2~2.1초). Stop hook(async)에서 이를 실행해 기록하도록 구현(v0.2.0). `--bare`는 OAuth를 읽지 않아 사용률이 안 나온다. hook 입력·기록 파일·OpenTelemetry에는 사용률이 없다.
   - Code 탭에서 Stop hook이 실제로 값을 받는지는 미확인.
   - Code 탭에서 `/partition:ui`가 hook에서 처리됨(토큰 0) 확인. 화면에는 "훅이 프롬프트를 차단했습니다" + 결과.
   - 플러그인 설치 후 새 Code 탭 세션에서도 install.json의 pluginRoot가 바뀌지 않았다 → SessionStart가 돌지 않았을 수 있음(미확인).
2. ~~대화형 모드에서도 슬래시 명령이 hook에 먼저 들어오는지~~ → **확인(2026-10-29, 터미널 대화형).** `/partition:status`가 UserPromptSubmit hook에서 처리되고 AI 응답 없이 끝남. 화면에 "UserPromptSubmit operation blocked by hook:" + 결과 + "Original prompt: …"가 표시됨. SessionStart의 systemMessage는 "SessionStart:startup says: …"로 보임. Code 탭에서는 미확인.
3. 실제 Pro 계정에서 rate_limits가 들어오는지 → **확인(터미널 대화형, Pro). 첫 응답 전에도 값이 있었음(5시간 12%, 주간 17%).** 배분이 맞는지는 미확인.
4. ~~AI가 마무리 지시를 따르는지~~ → **1회 확인(`claude -p`, Opus 5.5).** 마무리 단계에서 큰 작업을 요청하자 시작하지 않고 남은 일만 정리함(1턴). 표본 1회.
5. Codex hook이 `/hooks` 신뢰 후 Desktop에서 동작하는지

## 6. 남은 일

- 위 5번 항목 실사용 검증
- README(영/한), LICENSE(MIT, 저작권자 표기 미정), CONTRIBUTING, 아이콘
- 공개 전 정리: `.codex/` 테스트 파일, `hello.txt`, `tools/analysis/` 공개 여부
