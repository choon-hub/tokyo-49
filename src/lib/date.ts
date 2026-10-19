// 訪問日は端末のローカル日付で扱い、'YYYY-MM-DD' の文字列で保存する。
// toISOString() は UTC になり、JST の 0:00〜8:59 では前日になるので使わない。

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** ローカルの年・月・日から 'YYYY-MM-DD' を作る。 */
export function toLocalDateString(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/** 'YYYY-MM-DD' の形式で、かつ実在する日付か。 */
export function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** 'YYYY-MM-DD' をローカル時刻の 0:00 の Date にする。不正な値は例外。 */
export function parseLocalDate(value: string): Date {
  if (!isValidDateString(value)) {
    throw new Error(`日付の形式が正しくありません: ${value}`);
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 表示用。'2026-10-18' → '2026年10月18日（日）' */
export function formatJapaneseDate(value: string): string {
  const date = parseLocalDate(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
}
