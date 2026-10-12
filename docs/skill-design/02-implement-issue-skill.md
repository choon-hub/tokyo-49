# 実装オーケストレーションskill（`implement-issue`）設計書

最終更新: 2026-10-12

## 1. 目的と位置づけ

設計skill（[01-design-issue-skill.md](01-design-issue-skill.md)）で作った**設計Issueの番号**を受け取り、実装 → テスト → レビュー → コミット・push → PR作成までを、サブエージェントに振り分けて進める。

```
/implement-issue <設計Issue番号>
        │
        ▼
 ┌────────────── implement-issue（オーケストレーター / メインセッション）──────────────┐
 │  準備 → implementer → 【ゲート①】→ tester ⇄ implementer → reviewer ⇄ implementer   │
 │        → 【ゲート②】→ pr-creator → 後片付け                                     │
 └────────────────────────────────────────────────────────────────────────────────┘
```

### 設計方針
- **オーケストレーターはコードを書かない。** 役割は、サブエージェントへの引き継ぎ、確認ゲート、差し戻しの判断に限る（[R5](#3-調査の要点ナレッジベストプラクティス)・[R6](#3-調査の要点ナレッジベストプラクティス)）。
- **作業はそれぞれ独立したコンテキストのサブエージェントで行う。** メインのコンテキストを汚さず、レビューは実装の経緯を知らない新しい目で行う（[R1](#3-調査の要点ナレッジベストプラクティス)）。
- **skillとサブエージェント定義は最小限にする。** 実装やテストのやり方はモデルの推論に任せる。固定するのは、順序、ゲート、差し戻しの上限、受け渡す情報の項目だけにする（[R3](#3-調査の要点ナレッジベストプラクティス)）。
- **人の確認は2回にする（ユーザー指定）。** テストの前と、PR作成の前。

---

## 2. 要件

| # | 要件 | 備考 |
|---|---|---|
| F1 | 設計Issue番号を引数で受け取る | |
| F2 | Issue専用のブランチとworktreeで作業し、mainの作業ツリーを汚さない | 複数Issueの並行作業も可能にする |
| F3 | 実装・テスト・レビュー・コミット/push/PRを、それぞれ別のサブエージェントに任せる | レビューの追加はユーザー回答 |
| F4 | **ゲート①（テスト前）**: 実装結果を提示し、テストへ進む・修正・中止を選ばせる | ユーザー指定 |
| F5 | **ゲート②（PR作成前）**: 差分・テスト結果・レビュー結果・PR案を提示し、作成・修正・中止を選ばせる | ユーザー指定。push前でもある |
| F6 | テストの失敗やレビューの重大指摘は、自動でimplementerに差し戻す。上限を超えたらユーザーに判断を仰ぐ | テスト3回、レビュー2回 |
| F7 | PRの本文に `Closes #<設計Issue>` と、受け入れ要件ごとの充足状況（根拠つき）を書く | |
| F8 | 失敗・中止の場合はworktreeを残し、状態と再開方法を報告する | |

---

## 3. 調査の要点（ナレッジ・ベストプラクティス）

2026-10-12に調べた結果。スター数は検索時点の値。

| # | 出典 | 人気の指標 | 本skillに取り入れた点 |
|---|---|---|---|
| R1 | [Best practices for Claude Code（公式）](https://code.claude.com/docs/en/best-practices) | 公式 | 「Claudeが自分で回せる検証手段を与える」「成功を主張させず証拠を示させる」。Writer/Reviewer パターン（新しいコンテキストは自分が書いたコードに引きずられない）。**敵対的レビュー**: 差分と基準だけを見せる。正しさと要件に関わる指摘だけを挙げさせ、過剰な修正を避ける |
| R2 | [Create custom subagents（公式）](https://code.claude.com/docs/en/sub-agents) | 公式 | frontmatter の項目（`tools` / `disallowedTools` / `model` / `effort` / `maxTurns` / `isolation` など）。サブエージェントのネストは既定で3階層まで。**`isolation: worktree` は既定ブランチから一時worktreeを切る**ので、工程間で状態を共有するパイプラインには向かない |
| R3 | [The new rules of context engineering for Claude 5 generation models](https://claude.dev/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models/)（Anthropic MTS, 2026-07） | Anthropic社員による記事 | Claude Codeのシステムプロンプトの8割以上を削っても評価は下がらなかった。制約を減らしてモデルの判断に任せ、例ではなくインターフェース（状態の列挙と最小限のルール）で示す。受け渡しの形式はこの考え方で定義した |
| R4 | [Skills（Claude Code公式）](https://code.claude.com/docs/en/skills) | 公式 | 副作用のあるワークフローには `disable-model-invocation: true`。`context: fork` にするとサブエージェントとして実行される（今回は使わない。理由は[7章](#7-skillmd-ドラフト)） |
| R5 | [Claude Codeのスキル×サブエージェントで開発ワークフローを丸ごと自動化したら…](https://zenn.dev/arufian/articles/4676070054c347)（Zenn, 2026-07） | 国内の実践記事 | 指揮役のskillと実行役のサブエージェントに分ける。サブエージェントは会話を知らないので、必要な情報はオーケストレーターが明示的に渡す。サブエージェント同士は直接やりとりしない。「やれ」と書くだけでは工程を飛ばされたため、**止まる条件を明記した必須ゲート**で防いだ |
| R6 | [I Built an Orchestrator AI Agent That Takes My Github issue to Pull Requests](https://medium.com/@urvvil08/built-an-orchestrator-ai-agent-that-takes-my-issue-to-pull-requests-ab1912c93b52)（Medium, 2026-04） | 実践記事 | オーケストレーター1つ、サブエージェント5つ、人のゲート3つの構成。「オーケストレーターはコードを直接変更せず、必ず委譲する」 |
| R7 | [obra/superpowers](https://github.com/obra/superpowers) | 約297k stars | subagent-driven-development: タスクごとに新しいサブエージェントを使い、実装後にレビューを挟む |
| R8 | [Claude Code Multi-Agent Orchestration: 2026 Guide](https://www.tembo.io/blog/claude-code-multi-agent-orchestration)（Tembo） | 解説記事 | サブエージェント、Agent Teams、外部オーケストレーターの使い分け。サブエージェント同士は会話しない。今回はセッション内のサブエージェントで足りる |
| R9 | AskUserQuestion の制約（[#12890](https://github.com/anthropics/claude-code/issues/12890)、[#34592](https://github.com/anthropics/claude-code/issues/34592)） | 公式リポジトリのIssue | **サブエージェントでは AskUserQuestion を使えない**（not planned でクローズ）。確認ゲートはメインセッションに置き、サブエージェントには質問を「返させる」 |
| R10 | [anthropics/skills](https://github.com/anthropics/skills) / [github/spec-kit](https://github.com/github/spec-kit) | 約180k / 約141k stars | skillの構成と、仕様（設計Issue）を中心に据えた開発の流れ |

> PV・いいね数は、多くの記事で取得できなかった。そのため人気の指標はGitHubスター数と公式であることに限っている。

---

## 4. 構成要素

### 4.1 skillかサブエージェントか

| 単位 | 実体 | 選んだ理由 |
|---|---|---|
| オーケストレーター | **skill**（`implement-issue`、メインセッションで実行） | AskUserQuestion（ゲート）とサブエージェントの起動が必要。どちらもメインセッションでしかできない（R9） |
| 実装 | **サブエージェント** `implementer` | ファイルを大量に読むので、コンテキストを隔離したい |
| テスト | **サブエージェント** `tester` | テストの出力が大きい。実装者と別の視点でテストを書かせる |
| レビュー | **サブエージェント** `reviewer`（読み取り専用） | 新しいコンテキストで敵対的にレビューさせる（R1） |
| コミット・push・PR | **サブエージェント** `pr-creator` | gitの出力をメインに持ち込まない。軽いモデルで足りる |

サブエージェント側にskillを置かない理由: 各サブエージェントの指示はごく短く、定義ファイルの本文で足りる。プロジェクト共通の知識（テストやlintのコマンドなど）は `CLAUDE.md` に置けば、全サブエージェントが読み込む。

### 4.2 ファイル構成

```
.claude/
├── skills/
│   └── implement-issue/
│       └── SKILL.md          # 順序・ゲート・差し戻しの上限・受け渡し項目
└── agents/
    ├── implementer.md
    ├── tester.md
    ├── reviewer.md
    └── pr-creator.md
CLAUDE.md                      # テスト/lint/型チェックのコマンド、ブランチ・コミット規約（前提）
```

**前提**: Expoプロジェクトの雛形を作った時点で、`CLAUDE.md` に `npm test` / `npm run lint` / `npx tsc --noEmit` などの実コマンドを書く。skillやサブエージェントにはコマンドを直接書かない。

---

## 5. 処理フロー

```
/implement-issue <N>
 │
 ├─ 0. 事前確認   gh auth / Issue #N がオープン / 「受け入れ要件」がある
 │               （無ければ /design-issue での作成を案内して止まる）
 │
 ├─ 1. 準備       Issue本文からブランチ名 <type>/<N>-<slug> を推論する
 │               git worktree add ../tokyo-49-worktrees/<type>-<N>-<slug> -b <branch>
 │               依存パッケージをインストールする（npm ci など）
 │
 ├─ 2. implementer ── 報告: 変更の概要 / 変更したファイル / 設計からの逸脱 / 質問
 │
 ├─ 3. 【ゲート①】 実装の報告と git diff --stat を提示
 │      ├ テストへ進む
 │      ├ 修正（指示を入力）→ 2 へ（指示を添える）
 │      └ 中止 → worktreeを残して終了
 │      ※ implementer から質問があれば、ここでユーザーに尋ねて回答を添えて 2 へ
 │
 ├─ 4. tester ── 報告: pass / fail（テスト側の問題）/ needs_fix（実装の不具合）
 │      needs_fix → implementer（不具合情報を添える）→ tester   … 最大3回
 │
 ├─ 5. reviewer ── 報告: pass / blocking（指摘＋根拠）
 │      blocking → implementer → tester → reviewer             … 最大2回
 │      non-blocking の指摘は直さず、ゲート②とPR本文に記載する
 │
 ├─ 6. 【ゲート②】 差分の要約 / テストの証拠 / レビュー結果 / PRのタイトル・本文案を提示
 │      ├ PRを作成
 │      ├ 修正（指示を入力）→ 2 へ（以降 4・5 を再実行）
 │      └ 中止 → worktreeを残して終了（commitもpushもしない）
 │
 ├─ 7. pr-creator ── commit（Conventional Commits）→ push -u → gh pr create
 │                   報告: ブランチ / コミットハッシュ / PRのURL
 │
 └─ 8. 後片付けと報告  worktree を削除（ブランチは残す）→ 結果を表示
```

### 5.1 確認ゲートの設計

どちらのゲートも AskUserQuestion で3択（＋自由入力）にする。情報は**判断に要るものだけ**を要約して出す。差分やログ全文は貼らない。

| ゲート | 提示する情報 | 選択肢 |
|---|---|---|
| ① テスト前 | 変更の概要、変更したファイル（`--stat`）、設計からの逸脱とその理由、implementerからの質問 | テストへ進む / 修正 / 中止 |
| ② PR作成前 | 受け入れ要件ごとの充足（根拠: テスト名・コマンド結果）、テストとlintの結果、レビューの non-blocking 指摘、PRのタイトルと本文案 | PRを作成 / 修正 / 中止 |

ゲート②はpushの前に置く。外部に公開される操作は、すべてゲートを通った後に行う。

### 5.2 差し戻しのルール

| 状況 | 差し戻し先 | 上限 | 上限を超えたとき |
|---|---|---|---|
| tester が `needs_fix` | implementer → tester | 3回 | 状況を示して「続行 / 手動で対応 / 中止」を尋ねる |
| reviewer が `blocking` | implementer → tester → reviewer | 2回 | 同上 |
| ゲートで「修正」 | implementer → 以降の工程をすべて再実行 | なし（人が判断） | — |

**上限の根拠**: 公式ベストプラクティス（R1）は、同じ問題で2回以上修正してもうまくいかなければ、コンテキストが失敗したアプローチで汚れているとしている。テストは機械的に直る失敗（型やlint）も含むので3回、レビューは判断が絡むので2回にした。

### 5.3 判断をモデルに任せる箇所（skillには書かない）
- ブランチの type（feat/fix/refactor/chore/docs/test）と slug
- 実装のやり方、探索の深さ、既存パターンの踏襲
- どのテストをどのレベルで書くか（設計Issueの「テスト観点」をもとにする）
- 失敗が「テスト側」か「実装側」か
- レビュー指摘の重大度
- コミットの分け方、コミットメッセージ、PR本文の書き方

---

## 6. サブエージェントとの受け渡し

サブエージェントは会話の内容を知らない（R5）。そのため**オーケストレーターが毎回、必要な情報を明示的に渡す**。返答は次の項目で返させる。例は示さず、項目と状態の列挙だけを定義する（R3）。

| サブエージェント | 入力 | 返す項目 |
|---|---|---|
| implementer | Issue番号、worktreeの絶対パス、（差し戻し時）修正指示・不具合・指摘 | `status`: done / blocked、変更の概要、変更したファイル、設計からの逸脱、ユーザーへの質問 |
| tester | Issue番号、worktreeのパス | `status`: pass / fail / needs_fix、実行したコマンドと結果の抜粋（証拠）、追加したテスト、実装側の不具合（file:line、再現条件） |
| reviewer | Issue番号、worktreeのパス、ベースブランチ | `verdict`: pass / blocking、指摘（severity: blocking / non-blocking、file:line、根拠、関係する受け入れ要件） |
| pr-creator | Issue番号、worktreeのパス、ブランチ名、承認済みのPRタイトルと本文 | ブランチ、コミットハッシュ、PRのURL |

- Issue本文は各サブエージェントが `gh issue view` で自分で読む。オーケストレーターが本文を中継すると、コンテキストを二重に使うため。
- サブエージェントの起動はAgentツールで行い、`subagent_type` に定義名を指定する。各工程は前の結果に依存するので、**完了通知を待ってから次に進む**（並列にはしない）。

---

## 7. SKILL.md ドラフト

本文は**80行前後**を目標にする。

```markdown
---
name: implement-issue
description: 設計Issueの番号を受け取り、専用worktreeで implementer → tester → reviewer → pr-creator の各サブエージェントを順に動かし、テスト前とPR作成前の2回ユーザーの確認を挟んでPRを作成する。設計済みIssueの実装に使う。
argument-hint: "[設計Issue番号]"
disable-model-invocation: true
allowed-tools: Bash(gh issue view *) Bash(gh auth status) Bash(git worktree *) Bash(git -C * diff *) Bash(git -C * status *)
---

# 設計Issueの実装オーケストレーション

対象: Issue #$ARGUMENTS

あなたはオーケストレーターです。コードの編集・テスト・コミットは自分で行わず、必ずサブエージェントに任せます。
サブエージェントは会話を知らないので、毎回 Issue番号・worktreeの絶対パス・差し戻し内容を明示して渡します。

## 手順
0. **事前確認**: Issueがオープンで「受け入れ要件」があることを確かめる。無ければ `/design-issue` を案内して止まる。
1. **準備**: Issueからブランチ名 `<type>/<N>-<slug>` を決め、`../tokyo-49-worktrees/` 配下にworktreeを作り、依存をインストールする。
2. **実装**: `implementer` を起動する。
3. **ゲート①**: 報告と `git diff --stat` を要約し、AskUserQuestion で「テストへ進む / 修正 / 中止」を選ばせる。
   implementer から質問があれば、ここで尋ねる。修正なら指示を添えて 2 へ戻る。
4. **テスト**: `tester` を起動する。`needs_fix` なら不具合を添えて implementer → tester（最大3回）。
5. **レビュー**: `reviewer` を起動する。`blocking` なら implementer → tester → reviewer（最大2回）。
   上限を超えたら、状況を示して「続行 / 手動対応 / 中止」を尋ねる。
6. **ゲート②**: 受け入れ要件ごとの充足と根拠、テスト結果、non-blocking指摘、PRのタイトル・本文案を示し、
   「PRを作成 / 修正 / 中止」を選ばせる。修正なら 2 へ戻り、4・5 を再実行する。
   PR本文には `Closes #<N>` と受け入れ要件のチェックリストを入れる。
7. **PR作成**: 承認されたタイトルと本文を `pr-creator` に渡す。
8. **後片付け**: PRの作成に成功したらworktreeを削除する（ブランチは残す）。Issue・ブランチ・PRのURLを報告する。

## 失敗・中止のとき
worktreeは削除しない。どの工程で止まったか、worktreeのパス、`git worktree remove <path>` を報告する。
```

### frontmatter の判断

| フィールド | 値 | 理由 |
|---|---|---|
| `disable-model-invocation` | `true` | push・PR作成という副作用がある。手動起動に限る（R4） |
| `context` | 指定しない | `fork` にするとサブエージェント内で動き、AskUserQuestion が使えない（R9） |
| `allowed-tools` | 準備と状況確認のコマンドだけ | 書き込み系（commit/push/pr create）はオーケストレーターに許可しない。pr-creator 側で扱う |
| `model` / `effort` | 指定しない | オーケストレーターの判断（差し戻し・要約）はセッションの設定に任せる |

---

## 8. サブエージェント定義ドラフト

どれも本文は10〜20行にする。共通の規約（コマンド・コミット形式）は `CLAUDE.md` に任せる。

### 8.1 implementer

```markdown
---
name: implementer
description: 設計Issueに沿って、指定されたworktree内でコードを実装する。テスト・コミットは行わない。implement-issue から呼ばれる。
tools: Read, Edit, Write, Bash, Glob, Grep, Agent
model: inherit
---
指定されたworktreeの中だけで作業する。最初に `gh issue view <N>` で設計Issueを読み、
受け入れ要件・スコープ外・実装方針・影響範囲を確かめてから実装する。
周囲のコードの書き方に合わせる。スコープ外には手を出さない。
判断に迷う点は推測で進めず、報告の「質問」に書いて返す。
差し戻しの場合は、渡された指示・不具合・指摘だけを直す。

返す項目: status(done|blocked) / 変更の概要 / 変更したファイル / 設計からの逸脱と理由 / 質問
```

### 8.2 tester

```markdown
---
name: tester
description: 設計Issueの受け入れ要件とテスト観点に沿ってテストを追加し、テスト・lint・型チェックを実行する。implement-issue から呼ばれる。
tools: Read, Edit, Write, Bash, Glob, Grep
model: sonnet
---
指定されたworktreeの中だけで作業する。`gh issue view <N>` で受け入れ要件とテスト観点を読み、
足りないテストを追加する。CLAUDE.md にあるテスト・lint・型チェックをすべて実行する。
テストコード・lint・型の問題は自分で直してよい。プロダクトコードの不具合は直さず needs_fix として返す。
失敗を握りつぶさない（skip・閾値の緩和・期待値の改ざんをしない）。

返す項目: status(pass|fail|needs_fix) / 実行したコマンドと結果の抜粋 / 追加したテスト / 実装側の不具合(file:line, 再現条件)
```

### 8.3 reviewer

```markdown
---
name: reviewer
description: worktreeの差分を、設計Issueの受け入れ要件とスコープ外に照らして新しい視点でレビューする。読み取り専用。implement-issue から呼ばれる。
tools: Read, Glob, Grep, Bash
disallowedTools: Edit, Write
model: inherit
effort: high
---
`gh issue view <N>` と、ベースブランチとの差分（`git -C <path> diff <base>...HEAD` と未コミット分）だけを根拠にレビューする。
blocking にするのは、正しさのバグ・受け入れ要件の未充足・スコープ外の変更・セキュリティ上の問題だけ。
好みやスタイルの指摘は non-blocking にとどめる。根拠（file:line と理由）の無い指摘はしない。

返す項目: verdict(pass|blocking) / 指摘[severity, file:line, 根拠, 関係する受け入れ要件]
```

### 8.4 pr-creator

```markdown
---
name: pr-creator
description: worktreeの変更を Conventional Commits でコミットし、pushして、承認済みのタイトル・本文でPRを作成する。implement-issue から呼ばれる。
tools: Bash, Read
model: haiku
---
指定されたworktreeの中だけで作業する。差分を見て Conventional Commits 形式でコミットする（論理単位で分けてよい）。
.env などのシークレットはステージしない。`git push -u origin <branch>` の後、
渡されたタイトルと本文で `gh pr create --base main --head <branch>` を実行する。
本文は渡されたものを変えない。force push はしない。

返す項目: ブランチ / コミットハッシュ / PRのURL
```

### 8.5 モデルとツールの割り当て

| エージェント | model | 理由 |
|---|---|---|
| implementer | inherit | 実装の質に直結するので、セッションのモデル（Opus想定）を使う |
| tester | sonnet | テストの追加と実行が中心。コストと速度のバランスを取る |
| reviewer | inherit + `effort: high` | 見落としを減らしたい。読み取り専用なので、コストのわりにリスクが小さい |
| pr-creator | haiku | 定型的なgit操作。品質に不満があれば sonnet に上げる |

---

## 9. エラーと例外の扱い

| 状況 | 振る舞い |
|---|---|
| `gh` が未認証 | `! gh auth login` の実行を案内して止まる |
| 同じブランチやworktreeが既にある | 既存のworktreeで再開するか、中止するかを尋ねる |
| 依存のインストールに失敗 | エラーを示して止まる。`.env` などのシークレットはworktreeにコピーしない |
| implementer が `blocked` | 理由を示してユーザーに判断を仰ぐ |
| push や PR作成に失敗 | commitは残したままエラーを報告する。worktreeは残す |
| サブエージェントが `maxTurns` などで途中終了 | 部分的な結果を示し、再実行するか中止するかを尋ねる |

---

## 10. 検証計画（skill自体のテスト）

| # | シナリオ | 期待する振る舞い |
|---|---|---|
| E1 | 小さな設計Issue（例: テーマ定義）を通しで実行する | ゲートで2回止まり、承認するとPRが作られる。PR本文に `Closes #N` と受け入れ要件のチェックリストがある |
| E2 | 実装に意図的な不具合が残るケース（例: 正規化の境界値） | tester が needs_fix を返し、implementer への差し戻しが自動で回る |
| E3 | ゲート①で「修正」を選ぶ | 指示が implementer に渡り、再びゲート①で止まる |
| E4 | ゲート②で「中止」を選ぶ | commitもpushもされず、worktreeが残り、再開方法が報告される |

確認するのは次の点。オーケストレーターが自分でコードを書いていないか。工程やゲートを飛ばしていないか。証拠（コマンドの結果）を示しているか。

---

## 11. 未確定事項・将来の拡張

| # | 論点 | 暫定案 |
|---|---|---|
| I1 | PRを Draft で作るか | Ready で作る（ゲート②で人が確認済みのため）。必要なら選択肢に「Draftで作成」を加える |
| I2 | PR作成後のworktree | 削除する。node_modules がかさむため。PRへのレビューコメント対応は、別途worktreeを作り直して行う |
| I3 | 誤操作の防止を hooks で強制するか | 初期は入れない。必要になったら PreToolUse で `git push --force` と main への直接pushを止める |
| I4 | Workflowツール（dynamic workflows）への移行 | 工程が直列でゲートもあるため、現状はAgentツールで足りる。複数Issueを並行処理するときに検討する |
| I5 | 設計Issue側への進捗コメント | 付けない。PRのリンクで追跡できる |
