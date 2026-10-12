# 既存skillのアーカイブ作業指示書

最終更新: 2026-10-12

## 1. 目的

新しく作るプロジェクトskill（`design-issue` / `implement-issue`）と役割が重なる、個人スコープ（`~/.claude/skills/`）の `github-*` skill群をアーカイブする。

この文書は、**Claude Code にそのまま渡して実行できる作業指示**として書いている。

### アーカイブする理由
1. **ルーティングが競合する**: `github-issue-workflow` の description は「GitHub Issueの実装を頼まれたときの既定の入口」になっている。新skillを手動起動にしても、「Issue #N を実装して」と自然文で頼むと旧skillが自動で起動してしまう。
2. **同名なら個人スコープが優先される**: Claude Code では同名skillが personal > project の順で優先される（[Skills docs](https://code.claude.com/docs/en/skills)）。今後、新skillやサブエージェントの名前を旧skillに寄せると、プロジェクト側が隠れる。
3. **保守が二重になる**: 同じ工程（実装・テスト・レビュー・commit/push・PR）の定義が2系統あると、どちらを直すべきか分からなくなる。

---

## 2. 対象一覧

### 2.1 アーカイブするもの（8件）

| 旧skill | 役割 | 新しい担当 |
|---|---|---|
| `github-issue-workflow` | 全体のオーケストレーター | `implement-issue`（skill） |
| `github-fetch-issue` | Issueの取得と要件の確認 | `implement-issue` の手順0とゲート①、および設計Issue（`design-issue`） |
| `github-implement-issue` | worktreeの作成と、実装〜pushの中継 | `implement-issue` の手順1〜7 |
| `github-implement` | 実装 | `implementer`（サブエージェント） |
| `github-test` | テストとlint | `tester`（サブエージェント） |
| `github-review` | レビュー | `reviewer`（サブエージェント） |
| `github-commit-push` | commitとpush | `pr-creator`（サブエージェント） |
| `github-create-pr` | PR作成とworktreeの削除 | `pr-creator`、および `implement-issue` の手順8 |

### 2.2 残すもの

| skill | 残す理由 | 必要な対応 |
|---|---|---|
| `github-resolve-conflicts` | コンフリクト解消は新skillの範囲外 | **要修正**: Step 5 で `github-test` を呼んでいる（[4章](#4-github-resolve-conflicts-の修正)） |
| `github-issues` | Issueの一般的な管理（MCP）。設計skillとは用途が違う | なし |
| `requirements-to-issues` | 要件からIssueを作る、設計skillより前の工程 | なし |
| `propose-feature` / `prompt-improvement` / `nuxt` | 無関係 | なし |

> `~/.claude/skills/` は**すべてのプロジェクトに効く**。アーカイブすると、他のプロジェクトでも旧skillが使えなくなる。他のプロジェクトで旧フローを使い続けたい場合は、そのプロジェクトの `.claude/skills/` にコピーしてからアーカイブする。

---

## 3. 作業手順

### 前提条件
- 新skill（`.claude/skills/design-issue`、`.claude/skills/implement-issue`）と、サブエージェント（`.claude/agents/*.md`）を作成済みで、[02](02-implement-issue-skill.md) の検証シナリオE1が通っている。
  - 新skillは `disable-model-invocation: true` なので、旧skillが残っていても `/implement-issue` での動作確認はできる。
- 削除ではなく**移動**する。元に戻せるようにするため。

### 手順

```
Archive Progress:
- [ ] Step 1: 他プロジェクトでの利用を確認
- [ ] Step 2: アーカイブ先へ移動
- [ ] Step 3: github-resolve-conflicts を修正
- [ ] Step 4: 動作確認
- [ ] Step 5: 記録
```

**Step 1: 他のプロジェクトで使っていないか確かめる**

旧skillの名前を参照しているファイルを探す。次のコマンドは、作業用ディレクトリの場所に合わせて調整する。

```bash
grep -rlE "github-(issue-workflow|fetch-issue|implement-issue|implement|test|review|commit-push|create-pr)" \
  ~/.claude/CLAUDE.md ~/.claude/settings.json ~/.claude/agents ~/.claude/commands \
  ~/Downloads/work/*/CLAUDE.md ~/Downloads/work/*/.claude 2>/dev/null
```

見つかったら、ユーザーに報告して判断を仰ぐ。`~/.claude/skills/` の中の参照は Step 3 で扱うので、ここでは除く。

**Step 2: アーカイブ先へ移動する**

`~/.claude/skills-archive/` は skill の読み込み対象ではない（[読み込み場所の一覧](https://code.claude.com/docs/en/skills)を参照）。ここへ日付つきで移す。`evals/` などの補助ファイルも一緒に移動する。

```bash
ARCHIVE=~/.claude/skills-archive/2026-10-12
mkdir -p "$ARCHIVE"
for s in github-issue-workflow github-fetch-issue github-implement-issue github-implement \
         github-test github-review github-commit-push github-create-pr; do
  mv ~/.claude/skills/"$s" "$ARCHIVE"/
done
ls "$ARCHIVE"; ls ~/.claude/skills
```

**Step 3: `github-resolve-conflicts` を修正する**（[4章](#4-github-resolve-conflicts-の修正)）

**Step 4: 動作確認**

| 確認すること | 方法 | 期待する結果 |
|---|---|---|
| 旧skillが読み込まれていない | 新しいセッションで `/` メニューを開く、または「使えるskillを一覧して」と頼む | `github-*` は `github-issues` と `github-resolve-conflicts` だけ |
| 自然文で旧フローが起動しない | 新しいセッションで「Issue #<N> を実装して」と頼む | 旧skillが起動しない。手動起動の新skillは自動起動しない仕様なので、`/implement-issue` を案内されるか、通常の対応になる |
| 修正したskillが動く | `github-resolve-conflicts` の SKILL.md を読む | `github-test` への参照が残っていない |

**Step 5: 記録する**

アーカイブ先に `README.md` を置き、日付・理由・後継・戻し方を書く。

```markdown
# Archived 2026-10-12
理由: tokyo-49 のプロジェクトskill（design-issue / implement-issue）に統合したため。
後継: docs/skill-design/02-implement-issue-skill.md（tokyo-49 リポジトリ）
戻し方: mv ~/.claude/skills-archive/2026-10-12/<skill> ~/.claude/skills/
```

---

## 4. `github-resolve-conflicts` の修正

`github-test` をアーカイブすると、Step 5 の呼び出し先がなくなる。テスト実行を**インラインの指示に置き換える**。このskillは他のプロジェクトでも使うので、プロジェクト固有のサブエージェント（`tester`）には依存させない。

| 箇所 | 現在 | 修正後 |
|---|---|---|
| チェックリスト（21行目付近） | `Step 5: Run tests and lint (github-test)` | `Step 5: Run tests and lint` |
| Step 5 の見出しと本文（115〜128行目付近） | `invoke github-test` / Skillツールで呼ぶ / `Tests: PASS` の出力形式 | 下の置き換え案 |
| frontmatter の `allowed-tools` | `Skill` を含む | `Skill` を外す（他に使っていなければ）。テスト実行用の `Bash` は既に許可されているか確認する |
| 52行目・146行目の「`github-implement-issue` / `github-create-pr` と同じ」 | 旧skillを参照している | 説明はその場に書いてあるので、参照の文言だけ削除する |

**Step 5 の置き換え案**

```markdown
### Step 5: Run Tests and Lint

In `WORKTREE_PATH`, run the project's test suite and linter (see the project's CLAUDE.md; otherwise infer from package.json or the equivalent).
Fix failures caused by the merge, then re-run until clean. Do not skip tests or weaken assertions.

If you fixed anything, commit those fixes as a separate conventional commit (e.g. `fix: resolve post-merge test failures`).
If failures remain that you cannot fix, do NOT push — go to Failure Handling.
```

---

## 5. 元に戻す方法

```bash
mv ~/.claude/skills-archive/2026-10-12/<skill名> ~/.claude/skills/
```

`github-resolve-conflicts` を修正前に戻すときは、作業前にとったバックアップを使う。作業前に `cp -R ~/.claude/skills/github-resolve-conflicts ~/.claude/skills-archive/2026-10-12/github-resolve-conflicts.orig` を実行しておくこと。

---

## 6. 完了条件

- [ ] 2.1 の8件が `~/.claude/skills-archive/2026-10-12/` にあり、`~/.claude/skills/` には無い
- [ ] `github-resolve-conflicts` に `github-test`・`github-implement-issue`・`github-create-pr` への参照が残っていない
- [ ] 新しいセッションで、旧skillが一覧にも自然文での起動にも出てこない
- [ ] アーカイブ先に `README.md`（理由・後継・戻し方）がある
