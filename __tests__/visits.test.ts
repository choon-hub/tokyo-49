import { migrateUserDb } from "../src/db/user-db";
import { addVisit, listVisits, type NewVisit } from "../src/db/visits";
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
