<p align="center">
  <img src="../.claude-plugin/icon.png" width="140" alt="Partition">
</p>

<h1 align="center">Partition</h1>

<p align="center">
  <em>한도는 하나. 프로젝트는 여럿. 각자 자기 몫만큼.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/hyuksanglee/partition?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-111111?style=flat-square" alt="Claude Code plugin">
  <img src="https://img.shields.io/badge/Codex-plugin-111111?style=flat-square" alt="Codex plugin">
  <img src="https://img.shields.io/badge/node-18%2B-111111?style=flat-square" alt="Node 18+">
  <img src="https://img.shields.io/badge/status-experimental-111111?style=flat-square" alt="Experimental">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/settings-dark.jpg">
    <img src="../assets/settings-light.jpg" width="560" alt="Partition 설정 창: 5시간 한도를 막대 하나로 보여준다. api-server는 40%p 중 12, docs는 10%p 중 0, web-app은 30%p 중 18.4를 썼고, 쓴 부분은 진하게, 남은 부분은 빗금으로 그린다. 오른쪽 끝 회색은 예산 밖 사용(15.6%p). web-app을 고르면 0–34.4%p까지 줄 수 있다.">
  </picture>
</p>

<p align="center">
  <strong>Claude Code 또는 Codex의 5시간·주간 한도를 프로젝트마다 나눠 줍니다.</strong><br>
  <strong>선에 가까워지면 경고하고, AI에게 마무리를 시키고, 그 프로젝트를 멈춥니다.</strong><br>
  <sub>다른 프로젝트는 계속 일합니다.</sub>
</p>

<p align="center">
  <sub><a href="../README.md">English</a></sub>
</p>

---

다들 겪어봤을 겁니다. 프로젝트 세 개를 열어 두었는데, 그중 하나가 긴 리팩터링을 하다가 오후에 5시간 한도를 100% 채웁니다. 나머지 둘은 저녁까지 기다립니다.

요금제 한도는 모든 작업이 같이 쓰는 하나의 통입니다. Partition은 컨테이너마다 메모리를 떼어 주듯 그 통을 나눕니다. `web-app`에 30%p, `api-server`에 40%p를 주면, `web-app`이 30을 다 썼을 때 `web-app`만 멈춥니다. `api-server`에는 40이 그대로 남아 있습니다.

## 숫자

왜 %로 예산을 잡는지, 왜 일찍 개입해야 하는지. 만든 사람의 Codex 기록(세션 119개, 요청 1,381개, 요청당 변화를 잴 수 있었던 건 300개)에서 직접 잰 값입니다. Claude Code 기록이 아닙니다.

| | 중앙값 | p90 | 최대 |
| --- | --- | --- | --- |
| **요청 하나**가 쓴 5시간 한도 | 0% | 9% | **91%** |
| 단계 사이에 오른 5시간 한도 | 1% | 3% | 25% |

- **요청 하나가 한도 대부분을 쓸 수도 있습니다.** 100%를 기다리면 늦습니다. 그래서 그 전에 개입합니다.
- **1%당 토큰이 모델마다 약 6배 달랐습니다**(약 4만~23만). 토큰으로 예산을 잡으면 모델마다 의미가 달라지므로, 한도 자체의 %p로 잡습니다.
- **단계마다 보통 1~3%씩 오릅니다.** 그래서 기본값으로 예산 **3%p** 앞에서 마무리를 시킵니다.

방법과 한계: [docs/usage-analysis.md](../docs/usage-analysis.md)

## 쓰기 전 / 쓴 후

예시: `web-app`에 5시간 한도 30%p를 준 경우

| | Partition 없이 | Partition 있으면 |
| --- | --- | --- |
| `web-app` 24%p | 계속 진행 | 한 번 경고 |
| `web-app` 27%p | 계속 진행 | Claude에게 하던 작업만 끝내고 남은 일을 정리하라고 지시 |
| `web-app` 30%p | 한도 전체를 다 쓸 때까지 계속 | `web-app`의 새 요청과 도구 실행 차단 |
| `api-server` | 리셋까지 대기 | 자기 몫 40%p가 그대로 |

## 동작 방식

아래는 Claude 연결 방식입니다. Codex는 수명 주기 훅으로 로컬 세션의 사용량을
읽습니다. [Codex 데스크톱](#codex-데스크톱-실험-단계)을 참고하세요.
두 서비스의 계정 한도와 프로젝트 예산·사용 기록은 각각 분리합니다.

```
 status line            hooks
 ───────────            ─────
 응답이 올 때마다         요청·도구 실행 직전마다
   │                      │
   ├─ rate_limits 읽기     ├─ /partition:* 명령? → 실행, Claude가 결과 표시
   ├─ 기록 파일의 새 토큰   ├─ 예산의 80%   → 한 번 경고
   │  읽기                 ├─ 3%p 앞      → 마무리 지시
   └─ 오른 만큼을 토큰     ├─ 예산 도달    → 차단
      비중대로 나눔        └─ 값 없음·오류 → 통과
```

1. **status line이 사용률을 봅니다.** Claude Code는 응답마다 status line에 `rate_limits`(5시간·주간 %, 리셋 시각)를 넘겨줍니다. hook에는 이 값이 오지 않아서 status line이 `~/.partition/`에 저장해 둡니다.
   데스크톱 앱 Code 탭은 status line을 실행하지 않습니다. 그래서 거기서는 응답이 끝날 때마다 백그라운드 `Stop` hook이 `claude -p "/usage"`를 실행해 같은 사용률을 받습니다. AI를 부르지 않아 토큰 0이고, 재보니 1~2초 걸렸습니다.
2. **오른 만큼을 토큰 비중대로 나눕니다.** status line은 세션 기록 파일의 새 줄도 읽어 그 프로젝트의 대기분에 토큰을 더합니다. 계정 사용률이 오르면 각 프로젝트가 대기분 비중만큼 가져갑니다.
3. **hook이 판단합니다.** 요청과 도구 실행 직전마다 프로젝트 몫을 예산과 비교합니다.

정확하진 않지만, 솔직합니다.

- **스스로 지키는 제한입니다.** 실제 한도는 Anthropic 서버가 관리합니다. Partition은 내 컴퓨터에서 세고 스스로 멈춥니다.
- **한 단계만큼 넘칠 수 있습니다.** 응답과 도구 실행 사이에서 동작하고, 하나가 진행되는 중간에는 멈추지 못합니다.
- **토큰 가중치는 가정입니다.** 입력 1, 캐시 생성 1.25, 캐시 읽기 0.1, 출력 5. API 가격 비율을 빌렸습니다. `~/.partition/config.json`에서 바꿀 수 있습니다.
- **어디서 썼는지 모르는 사용은 그렇게 표시합니다.** 웹이나 다른 기기에서 쓴 양은 *미귀속*, Partition이 세기 시작하기 전 사용은 *기타*로 따로 보여줍니다.
- **확실하지 않으면 통과시킵니다.** 값이 아직 없을 때, 창이 리셋됐을 때, Partition에 오류가 났을 때는 막지 않습니다. Partition 자신의 명령도 막지 않습니다.

## 설정 창

`/partition:ui`를 실행하면 작은 창이 열립니다(macOS는 기본 WebKit 창, 그 밖에는 Chrome 앱 모드나 기본 브라우저).

- **한도 전체를 막대 하나로** 보여줍니다. 프로젝트마다 자기 색으로, 쓴 만큼은 **진하게**, 남은 만큼은 **빗금**으로 그립니다.
- **오른쪽 끝 회색**은 어떤 예산에도 속하지 않는 사용입니다. Partition 적용 전, 웹·다른 기기, 예산 없는 프로젝트에서 쓴 양이에요. 이미 쓴 양이라 누구에게도 줄 수 없습니다.
- **막대 아래 선**은 고른 프로젝트에 줄 수 있는 범위입니다. 다른 프로젝트 몫 뒤부터 회색이 시작하는 곳까지예요.
- 슬라이더를 끌거나 숫자를 넣으면 막대에 바로 보이지만, **아래 바의 [저장]을 눌러야 저장됩니다.** `0`은 제한 없음이에요.
- **규칙** 탭에서는 경고 시점, 마무리 지시 시점, 차단 여부, 언어를 정하고, **연결** 탭에서는 status line 연결 상태를 봅니다.

## /partition:status

```
Partition · web-app

5시간 · 리셋 10/29 19:30
  이 프로젝트  ███████████████░░░░░░░░░  18.4 / 30%p
  계정 전체    ███████████░░░░░░░░░░░░░  46%
               ├ web-app     18.4%p
               ├ api-server    12%p
               └ 기타        15.6%p
```

프로젝트는 폴더 이름으로, 지금 프로젝트부터 보여주고 0인 줄은 뺍니다. 문구는 시스템 언어(한국어/영어)를 따르고, **규칙** 탭에서 고정할 수 있습니다.

## status line (터미널)

```
[web-app 18.4/30%p · 5h 46%]
```

`web-app`이 30%p 중 18.4%p를 썼고, 계정 전체로는 5시간 한도의 46%를 썼다는 뜻입니다. 주간 예산이 있으면 `· 7d 9/20%p`가 붙습니다. 원래 쓰던 status line이 있으면 그대로 실행되고 Partition이 옆에 붙습니다. 데스크톱 앱 Code 탭에는 status line이 표시되지 않습니다.

## 설치

Codex는 [두 명령으로 마켓플레이스 설치](#codex-데스크톱-실험-단계)를 사용하세요.
아래 절차는 Claude Code용입니다.

**Claude Code**에서, 두 번에 나눠 입력합니다.

```
/plugin marketplace add hyuksanglee/partition
```
```
/plugin install partition@partition
```

터미널에서 쓴다면 status line도 연결합니다(데스크톱 앱 Code 탭은 필요 없습니다).

```
/partition:setup
```

플러그인은 status line을 직접 설정할 수 없어서, 이 단계에서 `~/.claude/settings.json`의 `statusLine`을 바꿉니다. Claude가 바꿀 내용을 먼저 보여주고, 승인해야만 적용합니다.

이제 지금 있는 프로젝트에 몫을 줍니다.

```
/partition:budget 30
```

**Pro 또는 Max** 요금제(사용률 값은 구독자에게만 옵니다), **Node.js 18 이상**, macOS 또는 Linux가 필요합니다. 데스크톱 앱에서는 `claude` 명령도 설치돼 있어야 합니다(`PATH` 또는 `~/.local/bin`).

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `/partition:ui` | 설정 창 열기(위 설명 참고) |
| `/partition:status` | 이 프로젝트 사용량을 막대 그래프로, 계정 사용량을 프로젝트별로 |
| `/partition:budget <1-100 \| 0> [--week]` | 이 프로젝트의 5시간 한도 몫을 정합니다. `--week`를 붙이면 주간 한도. `0`(또는 `off`)은 제한 해제 |
| `/partition:setup` | status line 연결(터미널). 바꿀 내용을 먼저 보여줍니다. |

`ui`, `status`, `budget`은 Claude가 입력을 보기 전에 hook이 실행하고, Claude는 도구 없이 결과만 보여줍니다. 그래서 짧은 응답 하나만큼 사용량을 씁니다(새 `claude -p` 세션에서 $0.11로 측정, 대화가 길면 다시 읽는 양만큼 더 씁니다). hook만으로 AI 호출 없이 답할 수도 있지만, 그러면 Claude Code가 모든 답에 "훅이 프롬프트를 차단했습니다"를 붙여 오류처럼 보입니다.

프로젝트는 지금 있는 git 저장소의 최상위 폴더이고, git 저장소가 아니면 그 폴더입니다.

같은 명령을 터미널에서도 토큰 없이 쓸 수 있습니다: `node <플러그인 폴더>/src/cli.mjs help`

## FAQ

**정말 요금제 한도를 나누나요?**
아니요. 실제 계정 한도는 각 서비스가 관리합니다. Partition은 내 컴퓨터에서 프로젝트별로 세고, 자기 몫을 다 쓴 프로젝트를 멈춥니다. Claude와 Codex의 예산은 각각 독립적입니다.

**정확히 30%p에서 멈추나요?**
아니요. 단계 사이에서 동작하므로 응답이나 도구 실행 하나만큼 넘을 수 있습니다. 3%p 앞의 마무리 단계가 그 차이를 줄이려고 있습니다.

**Partition이 고장 나면요?**
통과시킵니다. 값이 없거나, 창이 리셋됐거나, Partition에 오류가 나도 막지 않습니다.

**데이터를 밖으로 보내나요?**
아니요. 전부 `~/.partition/`에만 있습니다.

**Claude 데스크톱 앱에서도 되나요?**
명령과 hook은 됩니다. Code 탭은 status line을 실행하지 않아서, 대신 응답이 끝날 때마다 `claude -p "/usage"`로 사용률을 읽습니다. 이 출력은 사람이 읽는 문장이라, 문구가 바뀌면 Partition은 그곳에서 사용량을 세지 못하고 고쳐질 때까지 모두 통과시킵니다.

**Codex는요?**
데스크톱용 실험적 연결부가 포함되어 있습니다. Claude와 예산·사용 기록을 분리합니다. 아래 Codex 데스크톱 항목을 참고하세요.

**어떻게 지우나요?**
`/partition:ui` → **연결** → **원래대로**를 누르면 원래 status line으로 돌아갑니다. 그다음 `/plugin uninstall partition@partition`, 원하면 `~/.partition/`도 지우세요.

**왜 이름이 Partition인가요?**
디스크 크기는 하나지만, 우리는 파티션마다 몫을 정해 줍니다.

## 상태

실험 단계입니다. Claude Code 2.1.312, Pro 요금제에서 확인했습니다(2026-10-29).

- [x] 터미널의 대화형 모드와 `claude -p`에서 `/partition:*` 명령은 AI보다 hook이 먼저 실행합니다.
- [x] status line에 실제 `rate_limits` 값이 들어옵니다.
- [x] Claude가 마무리 지시를 따라 새 작업을 시작하지 않았습니다(`claude -p`에서 한 번, Code 탭에서도).
- [x] 데스크톱 앱 Code 탭에서도 `/partition:*` 명령을 hook이 실행합니다.
- [x] Code 탭은 커스텀 status line을 **실행하지 않습니다** (`settings.json`에 연결했지만 실행되지 않음).
- [x] `claude -p "/usage"`는 토큰 0으로 5시간·주간 사용률을 돌려줍니다.
- [x] Code 탭에서 Partition의 백그라운드 `Stop` hook이 응답마다 그 값을 기록합니다.
- [x] 계정 사용률이 오른 만큼을 두 프로젝트의 토큰 비중대로 나눴습니다(Code 탭, 실제 사용).
- [ ] 예산 도달 시 차단을 실제 사용으로 확인
- [ ] 한 창 전체에 걸쳐 프로젝트별 배분이 실제와 얼마나 맞는지

결과나 문제는 [Issues](https://github.com/hyuksanglee/partition/issues)에 알려 주세요.

## Codex 데스크톱 (실험 단계)

다음 두 명령으로 설치합니다.

```bash
codex plugin marketplace add hyuksanglee/partition
codex plugin add partition@partition
```

Partition의 훅을 검토·신뢰 승인한 뒤 새 로컬 대화를 시작하세요. CLI의 `/hooks`
또는 Partition 설정의 **연결** 탭에서 검토할 수 있습니다. 이후 대화창에서:

- `/partition:ui` — 별도 설정 창 열기 (`$partition:ui` 스킬도 지원)
- `/partition:status` — 사용량 확인
- `/partition:budget 30` — 현재 프로젝트의 5시간 예산을 30%p로 설정

macOS에서는 UI 명령이 별도 `Partition.app` 창을 열고 이름·아이콘·준비 상태를
확인한 뒤 성공으로 안내합니다. 다른 운영체제에서는 Chrome 앱 모드나 기본
브라우저를 사용합니다. 앱의 브라우저 패널은 `ui --serve`로 선택할 수 있습니다.
훅 실행 환경의 PATH에 Node.js 18 이상이 있어야 합니다. 플러그인 명령을 지원하는
Codex와 수명 주기 훅을 지원하는 로컬 데스크톱 엔진이 필요합니다.

이전 사용자 훅 방식으로 연결했다면 해당 저장소에서
`node src/cli.mjs --provider codex uninstall --apply`로 그 훅을 제거한 뒤
플러그인 훅을 활성화하세요. 예산과 사용 기록은 보존합니다. 두 방식을 중복
등록하지 마세요.

Codex의 로컬 세션 JSONL에서 `token_count` 이벤트를 읽습니다. 사용량을
수집하기 위해 모델을 호출하지 않습니다. Claude 데이터는 기존 `~/.partition/`에,
Codex 예산·규칙·사용 기록은 `~/.partition/codex/`에 따로 저장합니다.

플러그인 설치 없이 개발할 때는 저장소 폴더에서 사용자 훅 연결을 사용할 수 있습니다.

```bash
node src/cli.mjs --provider codex setup --plan
node src/cli.mjs --provider codex setup --apply
```

`$CODEX_HOME/hooks.json`(기본 `~/.codex/hooks.json`)에 Partition 훅을 추가하며,
다른 훅은 보존합니다. 설정 창에서 **연결 → 상태 확인**을 누르고, 표시된 실행
명령과 이벤트를 검토하세요. 확인란을 선택하고 **검토한 훅 승인하고 연결**을 누르면
GPT 앱과 같은 엔진의 공식 API로 해당 훅만 신뢰 승인합니다. 다른 설정은 보존하며,
정의가 바뀌면 다시 검토해야 합니다. 승인 후 새 로컬 데스크톱 대화를 시작하세요.
CLI의 `/hooks`로 승인하는 기존 방법도 사용할 수 있습니다.
설정 파일 등록과 신뢰 승인, 실제 실행 확인은 별개입니다.

```bash
node src/cli.mjs --provider codex ui --detach --project /프로젝트/경로
node src/cli.mjs --provider codex budget 30 --project /프로젝트/경로
node src/cli.mjs --provider codex status --project /프로젝트/경로
node src/cli.mjs --provider codex uninstall --plan
node src/cli.mjs --provider codex uninstall --apply
```

주간 예산에는 `--week`를 붙이고, `0`으로 제한을 해제합니다. 예산을 지정하지
않은 프로젝트는 기록만 하며 차단하지 않습니다. 연결 탭에서 훅 실행이 기록됐는지
볼 수 있습니다. 제거는 Partition이 직접 등록한 훅만 지웁니다.

Codex도 `ui --detach`나 `/partition:ui`를 실행하면 macOS에서 Claude와 같은
별도 기본 WebKit 창이 열립니다. 창이 표시됐다는 준비 신호를 받은 뒤에만
성공으로 안내합니다.
창은 `Partition.app`으로 실행되어 Dock 이름과 아이콘도 Partition으로
표시됩니다. 첫 실행 시 macOS 기본 도구로 앱을 만들고 이후에는 재사용합니다.
Dock 아이콘은 다른 앱과 크기가 어울리도록 투명 여백을 포함합니다.
연결과 신뢰 승인이 끝났으면 예산 탭부터, 설정이 필요하면 연결 탭부터 열립니다.
프로젝트에 기록된 사용량보다 낮은 예산도 설정할 수 있으며, 저장 전에 다음
요청의 차단 여부를 안내합니다. 적용 전 계정 사용량은 이 판단에서 제외하고,
`0`은 계속 제한 해제를 뜻합니다.
설정 창은 편집 중이거나 잠시 다른 앱을 사용해도 자동 종료되지 않습니다.
직접 창을 닫을 때까지 유지합니다. 브라우저 모드도 편집 초안과 생존 신호를
분리해 저장하지 않은 변경 때문에 서버가 종료되지 않도록 했습니다.

앱 옆의 브라우저 패널에 띄우려면 `node src/cli.mjs --provider codex ui --serve`로
설정 서버를 실행하고, 출력된 로컬 URL을 앱 패널에서 여세요. 화면을 연 뒤에는
터미널 명령을 입력하지 않고 검토·승인할 수 있습니다.

`.agents/plugins/marketplace.json`이 Codex 마켓플레이스를 제공하고,
`.codex-plugin/plugin.json`이 `hooks/codex.json`과 `codex-skills/`를 연결합니다.
플러그인으로 설치했다면 사용자 훅 setup을 중복 실행하지 마세요.
플러그인의 `$partition:ui` 스킬로 별도 설정 창을 열 수 있습니다.
`/partition:*` 원문이 훅에 전달되면 직접 처리하지만, 클라이언트의 슬래시 명령
전달 방식은 보장하지 않습니다. 위 터미널 명령은 이 전달 방식과 무관하게 동작합니다.

자동 테스트로 프로토콜·파싱·배분·설정 보존·Claude 회귀 동작을 확인했고,
로컬 세션 기록 읽기와 임시 환경의 CLI 플러그인 설치도 확인했습니다. 설치된
데스크톱 엔진으로 임시 훅을 승인하고, 예산 초과 요청이 모델 생성 전에 차단되는
통합 테스트도 통과했습니다. 실제 사용자 환경의 훅은 별도로 직접 검토·승인해야
합니다. 실제 계정 사용량의 프로젝트별 배분 정확도는 계속 관찰이 필요합니다.
JSONL은 안정된 공개 API가 아니며, 알 수 없는 한도 종류는 집계하지 않습니다.
호스팅 도구나 일부 특수 경로는 도구 훅을 거치지 않고, 진행 중인 모델 응답은
중간에 멈출 수 없습니다. 기록 없음·창 만료·연결 오류는 통과시킵니다.
로컬 오케스트레이션이 없는 클라우드 대화는 지원 범위에 포함하지 않습니다.

2026-10-30 기준 자동 테스트 98개와 타입 검사가 통과했습니다. 마켓플레이스
설치, 훅 신뢰·차단, 서비스별 사용 기록 분리, 앱 이름·서명·아이콘, 기본 탭과
낮은 예산 저장을 검사합니다. 실제 설정 창도 저장 전 초안을 둔 상태로 2분 이상
유지되는 것을 확인했습니다.

근거: [Codex 훅](https://learn.chatgpt.com/docs/hooks),
[플러그인 패키징](https://developers.openai.com/plugins/build/plugins).

## 개발

```bash
npm install          # 개발용: 타입 검사용 TypeScript
npm test
npm run typecheck
claude --plugin-dir .
```

순수 JavaScript, 런타임 의존성 없음, 빌드 없음. 설계 문서: [docs/DESIGN.md](../docs/DESIGN.md)

## 라이선스

[MIT](../LICENSE). 각자 자기 몫만큼.
