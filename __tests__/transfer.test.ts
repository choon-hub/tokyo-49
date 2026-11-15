import type { Visit } from "../src/db/visits";
import { buildExport, parseImport } from "../src/lib/transfer";

const visit = (overrides: Partial<Visit>): Visit => ({
  id: 1,
  placeName: "西新宿",
  municipalityCode: "13104",
  source: "town",
  refId: 123,
  visitedOn: "2026-10-12",
  memo: null,
  createdAt: "2026-10-12T08:00:00.000Z",
  updatedAt: "2026-10-12T08:00:00.000Z",
  ...overrides,
});

describe("buildExport", () => {
  it("要件書 §2.5 の形式（version=1・exportedAt・visits）で、DB の id は含めない", () => {
    const file = buildExport(
      [visit({}), visit({ id: 2, placeName: "上野駅", memo: "花見" })],
      new Date("2026-10-12T08:00:00Z"),
    );

    expect(file).toEqual({
      version: 1,
      exportedAt: "2026-10-12T08:00:00.000Z",
      visits: [
        {
          placeName: "西新宿",
          municipalityCode: "13104",
          source: "town",
          refId: 123,
          visitedOn: "2026-10-12",
          memo: null,
          createdAt: "2026-10-12T08:00:00.000Z",
          updatedAt: "2026-10-12T08:00:00.000Z",
        },
        expect.objectContaining({ placeName: "上野駅", memo: "花見" }),
      ],
    });
    expect(Object.keys(file.visits[0])).not.toContain("id");
  });

  it("訪問が無くても、visits が空配列のファイルになる", () => {
    expect(buildExport([], new Date("2026-10-12T08:00:00Z")).visits).toEqual(
      [],
    );
  });

  it("書き出したものは、そのまま検証を通って同じ内容で読み戻せる", () => {
    const file = buildExport(
      [visit({}), visit({ id: 2, source: "manual", refId: null, memo: "メモ" })],
      new Date("2026-10-12T08:00:00Z"),
    );
    const parsed = parseImport(JSON.stringify(file));
    expect(parsed).toEqual({ ok: true, visits: file.visits });
  });
});

describe("parseImport", () => {
  const valid = {
    placeName: "西新宿",
    municipalityCode: "13104",
    source: "town",
    visitedOn: "2026-10-12",
  };
  const fileWith = (...visits: unknown[]) =>
    JSON.stringify({ version: 1, exportedAt: "x", visits });
  const errorOf = (text: string) => {
    const result = parseImport(text);
    if (result.ok) throw new Error("検証を通ってしまった");
    return result.error;
  };

  it("必須項目だけの訪問を受け入れ、無い項目は null で補う", () => {
    expect(parseImport(fileWith(valid))).toEqual({
      ok: true,
      visits: [
        {
          ...valid,
          refId: null,
          memo: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
    });
  });

  it("visits が空配列でも受け入れる", () => {
    expect(parseImport(fileWith())).toEqual({ ok: true, visits: [] });
  });

  it("空・空白だけのメモは null にする", () => {
    const result = parseImport(
      fileWith({ ...valid, memo: "" }, { ...valid, memo: " 　" }),
    );
    expect(result.ok && result.visits.map((v) => v.memo)).toEqual([null, null]);
  });

  it("JSON でないものは拒否する", () => {
    expect(errorOf("これは JSON ではない")).toBe("JSON として読み取れません");
    expect(errorOf("")).toBe("JSON として読み取れません");
  });

  it.each([["[]"], ["null"], ['"text"'], ["1"]])(
    "トップレベルがオブジェクトでない（%s）なら拒否する",
    (text) => {
      expect(errorOf(text)).toBe("ファイルの形式が正しくありません");
    },
  );

  it.each([[2], ["1"], [undefined], [null]])(
    "version が %p なら拒否する",
    (version) => {
      expect(errorOf(JSON.stringify({ version, visits: [] }))).toBe(
        "version が 1 ではありません",
      );
    },
  );

  it.each([[undefined], [null], [{}], ["[]"]])(
    "visits が配列でない（%p）なら拒否する",
    (visits) => {
      expect(errorOf(JSON.stringify({ version: 1, visits }))).toBe(
        "visits が配列ではありません",
      );
    },
  );

  it.each(["placeName", "municipalityCode", "source", "visitedOn"] as const)(
    "必須項目 %s が欠けていれば拒否する",
    (key) => {
      const { [key]: _removed, ...rest } = valid;
      expect(errorOf(fileWith(rest))).toBe(`visits[0].${key} がありません`);
      expect(errorOf(fileWith({ ...valid, [key]: null }))).toBe(
        `visits[0].${key} がありません`,
      );
      expect(errorOf(fileWith({ ...valid, [key]: 1 }))).toBe(
        `visits[0].${key} が文字列ではありません`,
      );
    },
  );

  it("要素がオブジェクトでなければ拒否する", () => {
    expect(errorOf(fileWith("西新宿"))).toBe(
      "visits[0] がオブジェクトではありません",
    );
    expect(errorOf(fileWith(valid, null))).toBe(
      "visits[1] がオブジェクトではありません",
    );
  });

  it("placeName が空・空白だけなら拒否する", () => {
    expect(errorOf(fileWith({ ...valid, placeName: " " }))).toBe(
      "visits[0].placeName が空です",
    );
  });

  it.each([["13301"], ["13216"], ["14101"], ["新宿区"], [""]])(
    "municipalityCode が49区市にない（%s）なら拒否する",
    (municipalityCode) => {
      expect(errorOf(fileWith({ ...valid, municipalityCode }))).toMatch(
        /^visits\[0\]\.municipalityCode が49区市のコードではありません/,
      );
    },
  );

  it.each([["facility"], ["Station"], [""]])(
    "source が station / town / manual 以外（%s）なら拒否する",
    (source) => {
      expect(errorOf(fileWith({ ...valid, source }))).toMatch(
        /^visits\[0\]\.source が station \/ town \/ manual のいずれでもありません/,
      );
    },
  );

  it.each(["station", "town", "manual"])("source が %s なら受け入れる", (source) => {
    expect(parseImport(fileWith({ ...valid, source })).ok).toBe(true);
  });

  it.each([
    ["2026-02-30"],
    ["2026-13-01"],
    ["2026/10/12"],
    ["2026-1-2"],
    ["2026-10-12T00:00:00Z"],
    [""],
  ])("visitedOn が実在する YYYY-MM-DD でない（%s）なら拒否する", (visitedOn) => {
    expect(errorOf(fileWith({ ...valid, visitedOn }))).toMatch(
      /^visits\[0\]\.visitedOn が実在する YYYY-MM-DD の日付ではありません/,
    );
  });

  it("うるう日や未来日は受け入れる", () => {
    expect(
      parseImport(
        fileWith(
          { ...valid, visitedOn: "2024-02-29" },
          { ...valid, visitedOn: "2099-12-31" },
        ),
      ).ok,
    ).toBe(true);
  });

  it.each([[1], [true], [{}], [[]]])(
    "memo が文字列でも null でもない（%p）なら拒否する",
    (memo) => {
      expect(errorOf(fileWith({ ...valid, memo }))).toBe(
        "visits[0].memo が文字列でも null でもありません",
      );
    },
  );

  it.each([["123"], [1.5], [{}]])(
    "refId が整数でも null でもない（%p）なら拒否する",
    (refId) => {
      expect(errorOf(fileWith({ ...valid, refId }))).toBe(
        "visits[0].refId が整数でも null でもありません",
      );
    },
  );

  it("不正が複数あっても、最初の不正箇所だけを返す", () => {
    expect(
      errorOf(
        fileWith(
          valid,
          valid,
          { ...valid, visitedOn: "2026-02-30", source: "x" },
          { ...valid, municipalityCode: "99999" },
        ),
      ),
    ).toBe(
      "visits[2].source が station / town / manual のいずれでもありません（x）",
    );
  });
});
