import {
  formatJapaneseDate,
  isValidDateString,
  parseLocalDate,
  toLocalDateString,
} from "../src/lib/date";

describe("toLocalDateString", () => {
  it("ローカルの年・月・日を 'YYYY-MM-DD' にし、月・日は0埋めする", () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toLocalDateString(new Date(2026, 11, 31, 23, 59))).toBe(
      "2026-12-31",
    );
  });

  it("UTC では前日になる時刻（JST 0:00〜8:59）でもローカルの日付になる", () => {
    // テストは TZ=Asia/Tokyo で動かす（jest.global-setup.js）。
    // JST 0:30 は UTC で前日の 15:30。
    const date = new Date(2026, 9, 18, 0, 30);
    expect(date.toISOString().slice(0, 10)).toBe("2026-10-17");
    expect(toLocalDateString(date)).toBe("2026-10-18");
  });

  it("うるう日と、年をまたぐ日付", () => {
    expect(toLocalDateString(new Date(2028, 1, 29))).toBe("2028-02-29");
    // JST 1月1日 8:59 は UTC で前年の 12月31日
    const newYear = new Date(2027, 0, 1, 8, 59);
    expect(newYear.toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(toLocalDateString(newYear)).toBe("2027-01-01");
  });
});

describe("isValidDateString", () => {
  it.each(["2026-10-18", "2028-02-29", "2026-12-31", "2027-01-01"])(
    "%s は有効",
    (value) => expect(isValidDateString(value)).toBe(true),
  );

  it.each([
    "2027-02-29", // うるう年でない
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "2026-10-1",
    "2026/10/18",
    "2026-10-18T00:00:00Z",
    "",
  ])("%s は無効", (value) => expect(isValidDateString(value)).toBe(false));
});

describe("parseLocalDate", () => {
  it("ローカル時刻の 0:00 の Date を返し、toLocalDateString で元に戻る", () => {
    const date = parseLocalDate("2026-01-01");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2026, 0, 1,
    ]);
    expect(date.getHours()).toBe(0);
    expect(toLocalDateString(date)).toBe("2026-01-01");
  });

  it("不正な値は例外", () => {
    expect(() => parseLocalDate("2026-02-30")).toThrow();
  });
});

describe("formatJapaneseDate", () => {
  it("日本語の表記に曜日をつける", () => {
    expect(formatJapaneseDate("2026-10-18")).toBe("2026年10月18日（日）");
    expect(formatJapaneseDate("2028-02-29")).toBe("2028年2月29日（火）");
  });
});
