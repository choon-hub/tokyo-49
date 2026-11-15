// 候補検索の入力の正規化（要件書 §6）。
// 表記ゆれ（ヶ／ケ、旧字体など）の追加の正規化は行わない。

/** NFKC 正規化 → 末尾の「駅」を除去 → trim。辞書の名前（漢字・カタカナ混じり）と突き合わせる形。 */
export function normalizeName(input: string): string {
  return input.normalize("NFKC").trim().replace(/駅$/, "").trim();
}

/** normalizeName に加えて、カタカナをひらがなにする。辞書の読みと突き合わせる形。 */
export function normalizeKana(input: string): string {
  return normalizeName(input).replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}

/** LIKE のワイルドカードを、`ESCAPE '!'` 用にエスケープする。 */
export function escapeLike(text: string): string {
  return text.replace(/[!%_]/g, (c) => `!${c}`);
}
