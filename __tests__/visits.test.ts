import { migrateUserDb } from "../src/db/user-db";
import {
  addVisit,
  countVisitsByMunicipality,
  listVisits,
  listVisitsByMunicipality,
  type NewVisit,
  updateVisit,
  type VisitChanges,
} from "../src/db/visits";
import { openTestDatabase } from "../test-utils/node-sqlite";

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const shinjuku: NewVisit = {
  municipalityCode: "13104",
  visitedOn: "2026-10-18",
  memo: "都庁",
  source: "manual",
  placeName: "新宿区",
};

async function setup() {
  const test = openTestDatabase();
  await migrateUserDb(test.db);
  return test;
}

const allRows = (raw: Awaited<ReturnType<typeof setup>>["raw"]) =>
  raw.prepare("SELECT * FROM visits ORDER BY id").all();

describe("addVisit", () => {
  it("§5.2 の列に値を入れて1行追加する（ref_id は NULL、created_at と updated_at は同じ UTC の ISO 8601）", async () => {
    const { db, raw } = await setup();
    const run = jest.spyOn(db, "runAsync");

    const id = await addVisit(db, shinjuku);

    expect(run).toHaveBeenCalledTimes(1);
    const [sql, params] = run.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/^INSERT INTO visits/);
    expect(params).toEqual([
      "新宿区",
      "13104",
      "manual",
      null,
      "2026-10-18",
      "都庁",
      expect.stringMatching(ISO_UTC),
      expect.stringMatching(ISO_UTC),
    ]);
    expect(params[6]).toBe(params[7]);

    const rows = allRows(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id,
        place_name: "新宿区",
        municipality_code: "13104",
        source: "manual",
        ref_id: null,
        visited_on: "2026-10-18",
        memo: "都庁",
      }),
    );
    expect(rows[0].created_at).toBe(rows[0].updated_at);
  });

  it("created_at は保存した時刻（UTC）", async () => {
    jest.useFakeTimers({
      now: new Date("2026-10-17T15:30:00.000Z"),
      doNotFake: ["nextTick", "setImmediate", "queueMicrotask"],
    });
    try {
      const { db, raw } = await setup();
      await addVisit(db, shinjuku);
      expect(allRows(raw)[0]).toEqual(
        expect.objectContaining({
          created_at: "2026-10-17T15:30:00.000Z",
          updated_at: "2026-10-17T15:30:00.000Z",
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    ["空文字", ""],
    ["空白だけ", "  \n\t　"],
    ["null", null],
  ])("メモが%sなら NULL で保存する", async (_label, memo) => {
    const { db, raw } = await setup();
    await addVisit(db, { ...shinjuku, memo });
    expect(allRows(raw)[0].memo).toBeNull();
  });

  it("同じ区市を2回追加すると別々の2行になる", async () => {
    const { db, raw } = await setup();
    const first = await addVisit(db, shinjuku);
    const second = await addVisit(db, shinjuku);

    expect(second).not.toBe(first);
    expect(allRows(raw)).toHaveLength(2);
  });

  it.each(["13123x", "13301", "", "13100"])(
    "マスタにない区市コード %p は拒否し、行を追加しない",
    async (municipalityCode) => {
      const { db, raw } = await setup();
      await expect(
        addVisit(db, { ...shinjuku, municipalityCode }),
      ).rejects.toThrow("49区市にない区市コード");
      expect(allRows(raw)).toHaveLength(0);
    },
  );

  it.each(["2026-02-30", "2026/10/18", "2026-10-18T00:00:00Z", ""])(
    "形式が不正な訪問日 %p は拒否し、行を追加しない",
    async (visitedOn) => {
      const { db, raw } = await setup();
      await expect(addVisit(db, { ...shinjuku, visitedOn })).rejects.toThrow(
        "訪問日の形式",
      );
      expect(allRows(raw)).toHaveLength(0);
    },
  );

  it.each([
    ["空文字", ""],
    ["空白だけ", "  \n\t　"],
  ])("場所名が%sなら拒否し、行を追加しない", async (_label, placeName) => {
    const { db, raw } = await setup();
    await expect(addVisit(db, { ...shinjuku, placeName })).rejects.toThrow(
      "場所名が空",
    );
    expect(allRows(raw)).toHaveLength(0);
  });

  it("区市名以外の場所名もそのまま保存する", async () => {
    const { db, raw } = await setup();
    await addVisit(db, { ...shinjuku, placeName: "新宿御苑" });
    expect(allRows(raw)[0].place_name).toBe("新宿御苑");
  });
});

describe("updateVisit", () => {
  const changes: VisitChanges = {
    placeName: "新宿御苑",
    visitedOn: "2099-12-31",
    memo: "庭園",
  };

  // 2行入れて、1行目（id は first）を編集の対象にする。
  async function setupTwoRows() {
    const test = await setup();
    const first = await addVisit(test.db, shinjuku);
    await addVisit(test.db, { ...shinjuku, visitedOn: "2026-10-01" });
    return { ...test, first };
  }

  it("場所名・訪問日・メモと updated_at だけを更新し、ほかの列と行は変えない", async () => {
    jest.useFakeTimers({
      now: new Date("2026-10-17T15:30:00.000Z"),
      doNotFake: ["nextTick", "setImmediate", "queueMicrotask"],
    });
    try {
      const { db, raw, first } = await setupTwoRows();
      const before = allRows(raw);

      jest.setSystemTime(new Date("2026-10-20T03:00:00.000Z"));
      await updateVisit(db, first, changes);

      const after = allRows(raw);
      expect(after).toHaveLength(2);
      expect(after[0]).toEqual({
        ...before[0],
        place_name: "新宿御苑",
        visited_on: "2099-12-31",
        memo: "庭園",
        updated_at: "2026-10-20T03:00:00.000Z",
      });
      expect(after[0].created_at).toBe("2026-10-17T15:30:00.000Z");
      // ほかの行は変わらない
      expect(after[1]).toEqual(before[1]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("過去日にも変えられる", async () => {
    const { db, raw, first } = await setupTwoRows();
    await updateVisit(db, first, { ...changes, visitedOn: "2000-02-29" });
    expect(allRows(raw)[0].visited_on).toBe("2000-02-29");
  });

  it("場所名の前後の空白を除いて保存する", async () => {
    const { db, raw, first } = await setupTwoRows();
    await updateVisit(db, first, { ...changes, placeName: " 　新宿御苑\t" });
    expect(allRows(raw)[0].place_name).toBe("新宿御苑");
  });

  it.each([
    ["空文字", ""],
    ["空白だけ", "  \n\t　"],
    ["null", null],
  ])("メモが%sなら NULL にする", async (_label, memo) => {
    const { db, raw, first } = await setupTwoRows();
    await updateVisit(db, first, { ...changes, memo });
    expect(allRows(raw)[0].memo).toBeNull();
  });

  it.each([
    ["空の場所名", { ...changes, placeName: "" }, "場所名が空"],
    ["空白だけの場所名", { ...changes, placeName: "  \n\t　" }, "場所名が空"],
    ["存在しない日付", { ...changes, visitedOn: "2026-02-30" }, "訪問日の形式"],
    ["区切りが違う日付", { ...changes, visitedOn: "2026/10/18" }, "訪問日の形式"],
    [
      "時刻つきの日付",
      { ...changes, visitedOn: "2026-10-18T00:00:00Z" },
      "訪問日の形式",
    ],
    ["空の日付", { ...changes, visitedOn: "" }, "訪問日の形式"],
  ])("%sは拒否し、DB を変えない", async (_label, input, message) => {
    const { db, raw, first } = await setupTwoRows();
    const before = allRows(raw);
    await expect(updateVisit(db, first, input)).rejects.toThrow(message);
    expect(allRows(raw)).toEqual(before);
  });

  it("存在しない id は拒否し、DB を変えない", async () => {
    const { db, raw, first } = await setupTwoRows();
    const before = allRows(raw);
    await expect(updateVisit(db, first + 100, changes)).rejects.toThrow(
      "訪問が見つかりません",
    );
    expect(allRows(raw)).toEqual(before);
  });
});

describe("listVisits", () => {
  it("訪問日の新しい順（同日は追加の新しい順）で、列名をキャメルケースにして返す", async () => {
    const { db } = await setup();
    await addVisit(db, { ...shinjuku, visitedOn: "2026-10-01" });
    await addVisit(db, {
      ...shinjuku,
      municipalityCode: "13229",
      placeName: "西東京市",
      memo: null,
    });
    await addVisit(db, shinjuku);

    const visits = await listVisits(db);
    expect(visits.map((v) => [v.id, v.visitedOn])).toEqual([
      [3, "2026-10-18"],
      [2, "2026-10-18"],
      [1, "2026-10-01"],
    ]);
    expect(visits[1]).toEqual({
      id: 2,
      placeName: "西東京市",
      municipalityCode: "13229",
      source: "manual",
      refId: null,
      visitedOn: "2026-10-18",
      memo: null,
      createdAt: expect.stringMatching(ISO_UTC),
      updatedAt: expect.stringMatching(ISO_UTC),
    });
  });
});

describe("listVisitsByMunicipality", () => {
  const nishitokyo: NewVisit = {
    ...shinjuku,
    municipalityCode: "13229",
    placeName: "西東京市",
  };

  it("指定した区市の行だけを返す", async () => {
    const { db } = await setup();
    await addVisit(db, shinjuku);
    await addVisit(db, nishitokyo);
    await addVisit(db, { ...shinjuku, visitedOn: "2026-10-01" });

    const visits = await listVisitsByMunicipality(db, "13104");
    expect(visits.map((v) => v.id)).toEqual([1, 3]);
    expect(visits.every((v) => v.municipalityCode === "13104")).toBe(true);
    expect(
      (await listVisitsByMunicipality(db, "13229")).map((v) => v.id),
    ).toEqual([2]);
  });

  it("訪問日の新しい順で、同じ日なら後から追加した行が先", async () => {
    const { db } = await setup();
    await addVisit(db, { ...shinjuku, visitedOn: "2026-10-01" });
    await addVisit(db, { ...shinjuku, visitedOn: "2026-10-18" });
    await addVisit(db, { ...shinjuku, visitedOn: "2025-12-31" });
    await addVisit(db, { ...shinjuku, visitedOn: "2026-10-18" });

    const visits = await listVisitsByMunicipality(db, "13104");
    expect(visits.map((v) => [v.id, v.visitedOn])).toEqual([
      [4, "2026-10-18"],
      [2, "2026-10-18"],
      [1, "2026-10-01"],
      [3, "2025-12-31"],
    ]);
  });

  it("訪問日が未来の行も返す", async () => {
    const { db } = await setup();
    await addVisit(db, shinjuku);
    await addVisit(db, { ...shinjuku, visitedOn: "2099-12-31" });

    const visits = await listVisitsByMunicipality(db, "13104");
    expect(visits.map((v) => v.visitedOn)).toEqual([
      "2099-12-31",
      "2026-10-18",
    ]);
  });

  it("行の無い区市では空の配列", async () => {
    const { db } = await setup();
    await addVisit(db, nishitokyo);
    expect(await listVisitsByMunicipality(db, "13104")).toEqual([]);
  });

  it("列名をキャメルケースにして返し、メモが NULL の行は null のまま", async () => {
    const { db } = await setup();
    await addVisit(db, { ...shinjuku, memo: null });

    expect(await listVisitsByMunicipality(db, "13104")).toEqual([
      {
        id: 1,
        placeName: "新宿区",
        municipalityCode: "13104",
        source: "manual",
        refId: null,
        visitedOn: "2026-10-18",
        memo: null,
        createdAt: expect.stringMatching(ISO_UTC),
        updatedAt: expect.stringMatching(ISO_UTC),
      },
    ]);
  });
});

describe("countVisitsByMunicipality", () => {
  const nishitokyo: NewVisit = {
    ...shinjuku,
    municipalityCode: "13229",
    placeName: "西東京市",
  };

  it("訪問がなければ空の結果", async () => {
    const { db } = await setup();
    expect(await countVisitsByMunicipality(db)).toEqual([]);
  });

  it("同じ区市に複数行あると、その行数を1件の結果にまとめる", async () => {
    const { db } = await setup();
    await addVisit(db, shinjuku);
    await addVisit(db, { ...shinjuku, visitedOn: "2026-10-01" });
    await addVisit(db, { ...shinjuku, memo: null });

    expect(await countVisitsByMunicipality(db)).toEqual([
      { municipalityCode: "13104", visitCount: 3 },
    ]);
  });

  it("複数の区市は別々に数え、区市コードの昇順で返す", async () => {
    const { db } = await setup();
    await addVisit(db, nishitokyo);
    await addVisit(db, shinjuku);
    await addVisit(db, nishitokyo);

    expect(await countVisitsByMunicipality(db)).toEqual([
      { municipalityCode: "13104", visitCount: 1 },
      { municipalityCode: "13229", visitCount: 2 },
    ]);
  });

  it("ある区市の行を全部消すと、その区市は結果から消える（他の区市は残る）", async () => {
    const { db, raw } = await setup();
    await addVisit(db, shinjuku);
    await addVisit(db, shinjuku);
    await addVisit(db, nishitokyo);

    raw.prepare("DELETE FROM visits WHERE municipality_code = ?").run("13104");

    expect(await countVisitsByMunicipality(db)).toEqual([
      { municipalityCode: "13229", visitCount: 1 },
    ]);
  });

  it("訪問日が未来の行も数える", async () => {
    const { db } = await setup();
    await addVisit(db, { ...shinjuku, visitedOn: "2099-12-31" });

    expect(await countVisitsByMunicipality(db)).toEqual([
      { municipalityCode: "13104", visitCount: 1 },
    ]);
  });

  it("マスタにないコードの行もそのまま返す（突き合わせは呼び出し側）", async () => {
    const { db, raw } = await setup();
    raw
      .prepare(
        `INSERT INTO visits
  (place_name, municipality_code, source, ref_id, visited_on, memo, created_at, updated_at)
VALUES ('不明', '13301', 'manual', NULL, '2026-10-18', NULL, 'x', 'x')`,
      )
      .run();

    expect(await countVisitsByMunicipality(db)).toEqual([
      { municipalityCode: "13301", visitCount: 1 },
    ]);
  });
});
