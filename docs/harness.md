# ハーネス変更記録

ハーネス（AGENTS.md、CLAUDE.md、skill、settings、CI、Ruleset など）を追加・変更・削除したら、1行追記する。
方針と計画: docs/harness-plan.md

| 日付 | 対象 | 種別 | 理由（どの失敗・判断によるものか） | 見直し・撤去の条件 |
|---|---|---|---|---|
| 2026-10-18 | AGENTS.md / CLAUDE.md | 追加 | 指示ファイルが無かった | 80行を超えたら削る。モデルの更新時に見直す |
| 2026-10-18 | npm run lint / check | 追加 | 検証コマンドが無く、AI が自分で検証を回せなかった | — |
| 2026-10-18 | .claude/settings.json | 追加 | auto mode 用の最低限の allow / deny | deny がすり抜けられた、または不要になったら見直す |
| 2026-10-18 | CI / Ruleset | 追加 | main の保護と品質ゲートを仕組みで担保するため | — |
| 2026-10-18 | .claude/skills/implement-issue | 追加 | 設計Issueから PR までの定型ワークフローに、順序・確認ゲート（計画承認・PR 作成前の2回、D7）・止まる条件が要るため | skill を使わなくなった、またはモデルが指示なしで同じ手順を踏めるようになったら撤去 |
| 2026-10-18 | implement-issue の worktree 手順 | 計画から変更 | 計画書は「公式の worktree 機能でブランチ `<type>/<N>-<slug>`」だったが、公式の `--worktree` / `EnterWorktree` の `name` はブランチ名が `worktree-<name>` に固定される（公式ドキュメントで確認）。AGENTS.md のブランチ命名規約を守るため、`git worktree add --no-track -b` で作り、`EnterWorktree` を `path` 指定で使う | 公式がブランチ名を指定できるようになったら、公式の機能だけに戻す |
| 2026-10-18 | .github/workflows/claude-code-review.yml | 追加 | PR のレビューを GitHub Actions で自動化するため（D3）。トリガーは `synchronize` を除き、利用枠を節約する | 指摘が役に立たない状態が続く、または利用枠を圧迫するときは見直す。Ruleset の必須チェックにはしない |
| 2026-10-18 | claude-code-review.yml の導入方法 | 計画から変更 | 計画書は `/install-github-app` で生成した PR を調整する手順だったが、GitHub App のインストール後に Secret とワークフローの選択画面へ進まなかった。公式の「Manual setup」に従い、ワークフローは手で追加し、`CLAUDE_CODE_OAUTH_TOKEN` は `claude setup-token` で作って `gh secret set` で登録した | — |
| 2026-10-18 | .gitignore（`.claude/worktrees/`） | 追加 | 公式ドキュメントの推奨。worktree の中身が main 側で未追跡ファイルとして出ないようにする | — |
| 2026-10-18 | docs/skill-design/01・02 | 変更 | 02 は D2・D7 により置き換えたため注記（実装しない）。01 は指示の置き場所を CLAUDE.md から AGENTS.md に変更（D1） | 02 は参照されなくなったら削除してよい |
| 2026-10-18 | CI の Actions バージョン | 計画から変更 | 計画書は `checkout@v6` / `setup-node@v5` だったが、実行時点の最新メジャーはどちらも v7（`gh api` で確認）。計画書の「最新メジャーを確認する」に従い v7 を採用 | Node 24 系の runner 対応や非推奨警告が出たら見直す |
| 2026-11-07 | docs/loop-plan.md / harness-plan.md §7.5 | 追加 | 設計から PR、レビュー対応までを人が毎回手で回しており、ループで次の一手を決める仕組みに移行するため（ユーザーの判断） | L1〜L3 のどれも使わなくなったら、該当箇所を撤去する |
| 2026-11-07 | loop-plan.md の D11 / §6.2 / §8（routine の回数） | 計画から変更 | 計画書は「Pro は routine を1日5回まで」としていたが、公式ドキュメント（scheduled tasks、旧 routines）に1日あたりの上限は無く、1時間あたりの上限（定期実行は100回、Run now はタスクごとに30回）と、サブスクリプションの使用量の消費だけになっていた。1日1回の運用は残し、理由を使用量の節約に改めた | 公式の上限が変わったら見直す |
| 2026-11-07 | loop-plan.md の §6.1（routine のプロンプト） | 計画から変更 | クラウドの実行環境では GitHub の GraphQL が拒否され、`gh issue` と `gh pr` のサブコマンドが 403 になる（公式ドキュメントで確認）。GitHub の操作を `gh api`（REST）に統一した | クラウドで GraphQL が使えるようになったら戻してよい |
| 2026-11-07 | loop-plan.md の §5.1（`/goal` の扱い） | 確認のみ | `/goal` は v2.1.139 で追加された。skill と組み合わせる方法は公式に書かれていないため、§5.1 の決まりに従い CLAUDE.md には書かない。Draft PR をスキップし、Claude のコメントが既にある PR もスキップするという code-review プラグインの挙動は、計画書のとおりだった | 公式に組み合わせ方が書かれたら L1 / L3 で検討する |
| 2026-11-07 | .claude/skills/address-review / CLAUDE.md（2行） | 追加 | PR のレビュー指摘への対応を人が毎回手で回していたため、blocking が無くなるか上限（修正と評価を2周）に達したら止まるループにした（loop-plan L1）。手順5の評価は計画書どおり組み込みの general-purpose サブエージェントで行い、ローカルの `/code-review` は使わない（D9） | code-review の指摘がほぼ nit だけになり、手で対応しても負担が無い状態が続いたとき |
| 2026-11-07 | address-review の手順2・7 | 計画から変更 | 実際の PR（#31〜#50）で確かめた結果に合わせた。Claude のコメントの投稿者は REST では `claude[bot]`（`gh pr view` の表示では `claude`）なので、取得を `gh api .../issues/<N>/comments` にそろえて判別に使う。計画書の返信 API（`pulls/comments/<id>/replies`）はインラインコメントにしか使えないため、PR のコメントへの返信は `gh pr comment` にした。これまでの PR のレビューはすべて「No issues found.」で、指摘の付いたコメントの形式は未確認 | 指摘の付いたレビューの形式が判別方法と合わなかったら直す |
| 2026-11-07 | loop-plan.md の §5.4 R3 | 計画から変更 | 指摘を書くのは Actions の Bot で、「2周しても blocking が残る指摘」を狙って付ける方法が無いため、R3 の確認は見送った（ユーザーの判断）。止まる条件は SKILL.md に書いてある | 自然に起きたときに確かめ、結果をここに追記する |
