/** 半角・全角カタカナをひらがなにそろえる（NFKC → カタカナ→ひらがな）。 */
export function toHiragana(text) {
  return text
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
