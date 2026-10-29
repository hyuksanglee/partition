# Partition

**Claude Code 사용 한도를 프로젝트별로 나눠 쓰게 해주는 플러그인.**

[English](README.md)

Claude Pro·Max 요금제의 5시간 한도와 주간 한도는 모든 작업이 같이 씁니다. 여러 프로젝트를 동시에 하면 한 프로젝트가 한도를 다 써서 다른 프로젝트를 못 하게 되기도 합니다.

Partition은 컨테이너마다 메모리를 할당하듯, 각 한도를 프로젝트마다 %p 단위로 나눠 줍니다. 프로젝트가 자기 몫에 가까워지면 경고하고, Claude에게 마무리를 요청하고, 그 프로젝트의 새 요청을 막습니다.

> [!WARNING]
> **실험 단계입니다.** 계산 로직은 테스트로 확인했지만, 실제 Claude Code 세션에서는 아직 검증하지 않았습니다. 특히 다음은 아직 확인되지 않았습니다.
> - Claude 데스크톱 앱 Code 탭이 커스텀 status line을 실행하는지 (안 하면 그곳 사용량은 세지 않습니다)
> - 대화형 세션에서 `/partition:*` 명령이 AI보다 hook에 먼저 들어오는지 (`claude -p` 모드에서만 확인)
> - 프로젝트별 배분이 실제 사용과 얼마나 맞는지
> - Claude가 마무리 지시를 따르는지
>
> 문제나 결과는 [Issues](https://github.com/hyuksanglee/partition/issues)에 알려 주세요.

## 이런 도구입니다 / 이런 도구가 아닙니다

- **내 컴퓨터에서 스스로 지키는 제한입니다.** 실제 한도는 Anthropic 서버가 관리하므로 Partition이 쪼갤 수 없습니다. 대신 프로젝트별 사용량을 내 컴퓨터에서 세고, 정한 예산에 닿으면 그 프로젝트를 멈춥니다.
- **정확히 선에서 멈출 수는 없습니다.** 단계 사이에서 동작하므로 응답이나 도구 실행 하나만큼 예산을 넘을 수 있습니다.
- **값이 없거나 오류가 나면 막지 않습니다.** 사용률 값이 아직 없을 때, 한도 창이 리셋됐을 때, Partition 자체에 오류가 났을 때는 그대로 통과시킵니다.

## 필요한 것

- **Pro 또는 Max** 구독으로 쓰는 Claude Code (사용률 값은 구독자에게만, 세션의 첫 응답 이후부터 들어옵니다)
- `PATH`에 있는 **Node.js 18 이상**
- macOS 또는 Linux (Windows는 아직 지원하지 않습니다)

## 설치

Claude Code에서:

```
/plugin marketplace add hyuksanglee/partition
/plugin install partition@partition
```

그다음 status line을 연결합니다.

```
/partition:setup
```

플러그인은 status line을 직접 설정할 수 없어서, 이 단계에서 `~/.claude/settings.json`의 `statusLine`을 바꿉니다. Claude가 바꿀 내용을 먼저 보여주고, 승인한 뒤에만 적용합니다. 이미 쓰던 status line이 있으면 그대로 실행하고 Partition 표시를 옆에 붙입니다.

## 사용법

| 명령 | 하는 일 |
| --- | --- |
| `/partition:ui` | 설정 창 열기 |
| `/partition:status` | 이 프로젝트의 사용량과 예산 |
| `/partition:budget 30` | 이 프로젝트에 5시간 한도의 30%p 할당 |
| `/partition:budget 20 --week` | 이 프로젝트에 주간 한도의 20%p 할당 |
| `/partition:budget off` | 이 프로젝트의 예산 해제 |
| `/partition:setup` | status line 연결 (먼저 물어봄) |

`ui`, `status`, `budget`은 AI를 부르기 전에 hook이 처리하므로 토큰을 쓰지 않습니다. 결과와 함께 "operation blocked by hook" 문구가 보이는데, 정상입니다.

**프로젝트**는 지금 있는 git 저장소의 최상위 폴더이고, git 저장소가 아니면 현재 폴더입니다.

status line에는 이렇게 표시됩니다.

```
[my-app 12/30%p · 5h 41%]
```

`my-app`이 5시간 예산 30%p 중 12%p를 썼고, 계정 전체로는 5시간 한도의 41%를 썼다는 뜻입니다.

### 설정 창

`/partition:ui`를 실행하면 작은 창이 열립니다. macOS에서는 기본 WebKit 창, 그 밖에는 Chrome 앱 모드나 기본 브라우저로 열립니다.

- **예산**: 한도 전체를 막대 하나로 보여주고, 프로젝트별 할당과 미할당 부분을 표시합니다. 프로젝트를 고르면 줄 수 있는 범위(100 − 다른 프로젝트 할당)가 보입니다. 슬라이더를 움직이는 동안 막대가 바로 바뀌고, 손을 떼면 저장됩니다.
- **규칙**: 경고 시점, 마무리 지시 시점, 차단 여부를 정합니다.
- **연결**: status line 연결 상태와 마지막 실행 시각을 보여주고, 연결하거나 원래대로 되돌리는 버튼이 있습니다.

### 터미널

같은 기능을 토큰 없이 터미널에서도 쓸 수 있습니다.

```bash
node <플러그인 폴더>/src/cli.mjs status
```

`help`를 붙여 실행하면 모든 명령이 나옵니다.

## 동작 방식

1. **status line → 사용률.** Claude Code는 응답이 올 때마다 status line을 실행하고, `rate_limits.five_hour`, `rate_limits.seven_day`(사용률과 리셋 시각)를 넘겨줍니다. hook에는 이 값이 오지 않으므로 status line이 `~/.partition/state.json`에 저장해 둡니다.
2. **프로젝트별 배분.** status line은 세션 기록 파일에 새로 쌓인 줄도 읽어, 그 세션의 토큰을 해당 프로젝트의 *대기분*에 더합니다. 계정 사용률이 오르면 오른 만큼을 대기분 토큰 비중대로 나눕니다.
3. **단계.** 프로젝트·한도 창마다:
   - 예산의 **80%**에서 경고 (창마다 한 번)
   - 예산 **3%p** 앞에서 Claude에게 하던 작업을 마무리하라고 지시
   - 예산에 닿으면 새 요청과 도구 실행 차단 (차단은 끌 수 있습니다)
4. **Partition 자신의 명령은 절대 막지 않습니다.**

### 배분 방식과 한계

- 토큰은 API 가격 비율로 가중합니다: 입력 1, 캐시 생성 1.25, 캐시 읽기 0.1, 출력 5. **이것은 가정입니다.** 한도가 실제로 어떻게 계산되는지 Anthropic이 공개한 값이 아닙니다. 가중치는 `~/.partition/config.json`에서 바꿀 수 있습니다.
- 대기분 없이 오른 사용률(웹의 Claude, 다른 기기, status line이 없는 세션)은 **미귀속**으로 따로 표시합니다.
- Partition이 추적을 시작하기 전에 쓴 양은 **추적 전**으로 따로 표시합니다.
- 여러 세션을 동시에 돌리면 배분이 한쪽으로 치우칠 수 있습니다.
- 별도 기록 파일에 쓰는 서브에이전트 사용량은 프로젝트별로 세지 않습니다.
- 처음 보는 기록 파일은 최근 10분만 셉니다.

## 설정과 데이터

모든 데이터는 내 컴퓨터의 `~/.partition/`에만 있고, 어디에도 보내지 않습니다.

| 파일 | 내용 |
| --- | --- |
| `config.json` | 예산, 규칙, 토큰 가중치, 언어 |
| `state.json` | 창·프로젝트별 사용량, 기록 파일을 읽은 위치 |
| `install.json` | 현재 플러그인 경로, 원래 status line |
| `statusline.mjs` | `settings.json`에 등록되는 실행기 |

`config.json` 예:

```json
{
  "budgets": { "/Users/me/projects/my-app": { "fiveHour": 30, "sevenDay": 20 } },
  "rules": { "warnAt": 0.8, "wrapMarginPp": 3, "block": true },
  "weights": { "input": 1, "cacheWrite": 1.25, "cacheRead": 0.1, "output": 5 },
  "language": "auto"
}
```

## 삭제

1. `/partition:ui` → **연결** → **원래대로**를 누릅니다. `settings.json`의 status line이 원래 값으로 돌아갑니다.
2. `/plugin uninstall partition@partition`
3. 필요하면 `~/.partition/` 폴더를 지웁니다.

## 개발

```bash
npm install          # 개발용: 타입 검사용 TypeScript
npm test             # node:test
npm run typecheck    # jsconfig.json으로 JSDoc 타입 검사
claude --plugin-dir .
```

런타임 의존성과 빌드 없이 순수 JavaScript(ESM)로 작성했습니다. 폴더 구조와 설계는 [docs/DESIGN.md](docs/DESIGN.md)에 있습니다.

## 비슷한 프로젝트

- [Cuota](https://github.com/chechesa-labs/claude-code-cuota): 폴더별 5시간·주간 상한
- [claude-quota-guard](https://github.com/TakalaWang/claude-quota-guard): 프로젝트별 주간 %·달러 예산

## 라이선스

[MIT](LICENSE)
