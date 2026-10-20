import { MUNICIPALITIES } from "../src/data/municipalities";
import { summarizeConquest } from "../src/lib/conquest";

describe("summarizeConquest", () => {
  it("結果が空なら、訪問済みなし・制覇数 0", () => {
    const summary = summarizeConquest([]);
    expect(summary.visitedCount).toBe(0);
    expect(summary.visitedCodes.size).toBe(0);
  });

  it("行のある区市だけが訪問済みになる", () => {
    const summary = summarizeConquest([
      { municipalityCode: "13101", visitCount: 1 },
      { municipalityCode: "13229", visitCount: 5 },
    ]);
    expect(summary.visitedCount).toBe(2);
    expect([...summary.visitedCodes].sort()).toEqual(["13101", "13229"]);
    expect(summary.visitedCodes.has("13102")).toBe(false);
  });

  it("49区市すべてに行があれば制覇数は 49", () => {
    const summary = summarizeConquest(
      MUNICIPALITIES.map((m) => ({ municipalityCode: m.code, visitCount: 1 })),
    );
    expect(summary.visitedCount).toBe(49);
    expect(summary.visitedCodes.size).toBe(49);
  });

  it("訪問回数が多くても、同じ区市は1と数える", () => {
    const summary = summarizeConquest([
      { municipalityCode: "13104", visitCount: 100 },
    ]);
    expect(summary.visitedCount).toBe(1);
  });

  it("同じコードが重複して渡されても1と数える", () => {
    const summary = summarizeConquest([
      { municipalityCode: "13104", visitCount: 1 },
      { municipalityCode: "13104", visitCount: 2 },
    ]);
    expect(summary.visitedCount).toBe(1);
  });

  it.each(["13301", "13100", "13123x", ""])(
    "マスタにないコード %p は数えない",
    (municipalityCode) => {
      const summary = summarizeConquest([
        { municipalityCode, visitCount: 1 },
        { municipalityCode: "13101", visitCount: 1 },
      ]);
      expect(summary.visitedCount).toBe(1);
      expect([...summary.visitedCodes]).toEqual(["13101"]);
    },
  );

  it("件数が 0 の項目を渡されても訪問済みにしない", () => {
    const summary = summarizeConquest([
      { municipalityCode: "13101", visitCount: 0 },
    ]);
    expect(summary.visitedCount).toBe(0);
    expect(summary.visitedCodes.has("13101")).toBe(false);
  });
});
