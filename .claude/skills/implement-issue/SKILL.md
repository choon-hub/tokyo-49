---
name: implement-issue
description: 設計Issueの番号を受け取り、計画 → 実装 → 検証 → PR作成までを進める。計画の承認時とPR作成前の2回、ユーザーに確認する。設計済みのIssueを実装するときに使う。
argument-hint: "[設計Issue番号]"
disable-model-invocation: true
---

# 設計Issueの実装

対象: Issue #$ARGUMENTS

## 手順
1. **確認**: `gh issue view $ARGUMENTS` で読む。Issue がオープンで、「受け入れ要件」が書かれていること。無ければ `/design-issue` を案内して止まる。
2. **作業場所**: ブランチ `<type>/<N>-<slug>` の worktree を作って入る。`--worktree` や `EnterWorktree` の `name` はブランチ名が `worktree-<name>` に固定され、規約に合わないため使わない。
   `git fetch origin main` → `git worktree add --no-track .claude/worktrees/<N>-<slug> -b <type>/<N>-<slug> origin/main` → `EnterWorktree` を `path` 指定で呼ぶ。入ったら `npm ci` を実行する。
3. **計画**: 関係するコードを読み、変更するファイル、方針、追加するテストを短くまとめる。設計Issueとの食い違いや未決事項があれば挙げる。
4. **ゲート①**: 計画を提示し、AskUserQuestion で「実装する / 修正 / 中止」を選んでもらう。修正なら 3 に戻る。
5. **実装**: 計画に沿って実装し、受け入れ要件とテスト観点に対応するテストを書く。`npm run check` が通るまで直す。通っていない状態でゲート②に進まない。同じ失敗が3回続いたら止め、状況を報告して判断を仰ぐ。
6. **ゲート②**: 受け入れ要件ごとの充足状況と根拠（テスト名・コマンドの結果）、`git diff --stat`、PRのタイトルと本文の案を示し、AskUserQuestion で「PRを作成 / 修正 / 中止」を選んでもらう。修正なら 5 に戻る。
7. **PR作成**: Conventional Commits でコミットし、`git push -u origin HEAD` して `gh pr create` を実行する。本文には `Closes #<N>` と受け入れ要件のチェックリストを書く。
8. **報告**: PRのURLを示し、レビューは GitHub Actions が自動で付けると伝える。`ExitWorktree`（`keep`）で worktree から抜ける。

## 中止・失敗のとき
コミットも push もしない。worktree とブランチは残し、どの工程で止まったかと、再開の方法（worktree のパスと、やり直す手順の番号）を報告する。
