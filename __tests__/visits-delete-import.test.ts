import { migrateUserDb } from "../src/db/user-db";
import {
  addVisit,
  countVisitsByMunicipality,
  deleteVisit,
  importVisits,
  listVisits,
} from "../src/db/visits";
import type { TransferVisit } from "../src/lib/transfer";
import { openTestDatabase } from "../test-utils/node-sqlite";

async function openMigrated() {
  const opened = openTestDatabase();
  await migrateUserDb(opened.db);
  return opened;
}

const transferVisit = (overrides: Partial<TransferVisit>): TransferVisit => ({
  placeName: "西新宿",
  municipalityCode: "13104",
  source: "town",
  refId: 123,
  visitedOn: "2026-10-12",
  memo: null,
  createdAt: "2026-10-12T08:00:00.000Z",
  updatedAt: "2026-10-13T09:00:00.000Z",
  ...overrides,
});

describe("addVisit の refId", () => {
  it("候補から選んだ訪問は、辞書の id を ref_id に入れる", async () => {
    const { db } = await openMigrated();
    await addVisit(db, {
      municipalityCode: "13106",
      visitedOn: "2026-10-18",
      memo: null,
      source: "station",
      placeName: "上野駅",
      refId: 30,
    });
    const [visit] = await listVisits(db);
    expect(visit).toMatchObject({
      placeName: "上野駅",
      source: "station",
      refId: 30,
    });
  });

  it("refId を省いた手動の訪問は、ref_id が NULL", async () => {
    const { db } = await openMigrated();
    await addVisit(db, {
      municipalityCode: "13106",
      visitedOn: "2026-10-18",
      memo: null,
      source: "manual",
      placeName: "台東区",
    });
    expect((await listVisits(db))[0].refId).toBeNull();
  });
});

describe("deleteVisit", () => {
  const add = (db: Awaited<ReturnType<typeof openMigrated>>["db"], code: string) =>
    addVisit(db, {
      municipalityCode: code,
      visitedOn: "2026-10-18",
      memo: null,
      source: "manual",
      placeName: "x",
    });

  it("指定した id の行だけを削除する", async () => {
    const { db } = await openMigrated();
    const first = await add(db, "13104");
    const second = await add(db, "13104");

    await deleteVisit(db, first);

    expect((await listVisits(db)).map((v) => v.id)).toEqual([second]);
  });

  it("区市の最後の1件を削除すると、その区市は集計から消える（未訪問に戻る）", async () => {
    const { db } = await openMigrated();
    const shinjuku = await add(db, "13104");
    await add(db, "13101");

    await deleteVisit(db, shinjuku);

    expect(await countVisitsByMunicipality(db)).toEqual([
      { municipalityCode: "13101", visitCount: 1 },
    ]);
  });

  it("存在しない id は拒否し、ほかの行には触れない", async () => {
    const { db } = await openMigrated();
    await add(db, "13104");

    await expect(deleteVisit(db, 999)).rejects.toThrow("訪問が見つかりません");
    expect(await listVisits(db)).toHaveLength(1);
  });
});

describe("importVisits", () => {
  it("マージ: 空の DB には全件を追加し、ファイルの値（refId・時刻・メモ）をそのまま保持する", async () => {
    const { db } = await openMigrated();

    const result = await importVisits(
      db,
      [
        transferVisit({}),
        transferVisit({
          placeName: "東京ドーム",
          municipalityCode: "13105",
          source: "manual",
          refId: null,
          memo: "野球",
        }),
      ],
      "merge",
    );

    expect(result).toEqual({ added: 2, skipped: 0 });
    const visits = await listVisits(db);
    expect(visits).toHaveLength(2);
    expect(visits.find((v) => v.placeName === "西新宿")).toMatchObject({
      municipalityCode: "13104",
      source: "town",
      refId: 123,
      visitedOn: "2026-10-12",
      memo: null,
      createdAt: "2026-10-12T08:00:00.000Z",
      updatedAt: "2026-10-13T09:00:00.000Z",
    });
    expect(visits.find((v) => v.placeName === "東京ドーム")).toMatchObject({
      source: "manual",
      refId: null,
      memo: "野球",
    });
  });

  it("マージ: 場所名・区市・訪問日が既存と一致する行だけスキップし、既存の行は変えない", async () => {
    const { db } = await openMigrated();
    const existingId = await addVisit(db, {
      municipalityCode: "13104",
      visitedOn: "2026-10-12",
      memo: "元のメモ",
      source: "town",
      placeName: "西新宿",
    });

    const result = await importVisits(
      db,
      [
        // 3つとも一致 → スキップ
        transferVisit({ memo: "ファイルのメモ" }),
        // 訪問日だけ違う → 追加
        transferVisit({ visitedOn: "2026-10-13" }),
        // 区市だけ違う → 追加
        transferVisit({ municipalityCode: "13113" }),
        // 場所名だけ違う → 追加
        transferVisit({ placeName: "新宿" }),
      ],
      "merge",
    );

    expect(result).toEqual({ added: 3, skipped: 1 });
    const visits = await listVisits(db);
    expect(visits).toHaveLength(4);
    expect(visits.find((v) => v.id === existingId)?.memo).toBe("元のメモ");
  });

  it("マージ: ファイルの中で同じキーが重なっていても、既存に無ければどちらも追加する（同じ場所の複数回訪問）", async () => {
    const { db } = await openMigrated();

    const result = await importVisits(
      db,
      [transferVisit({}), transferVisit({})],
      "merge",
    );

    expect(result).toEqual({ added: 2, skipped: 0 });
    expect(await listVisits(db)).toHaveLength(2);
  });

  it("マージ: もう一度同じファイルを取り込むと、全件スキップで何も増えない", async () => {
    const { db } = await openMigrated();
    const file = [transferVisit({}), transferVisit({ placeName: "新宿" })];
    await importVisits(db, file, "merge");

    expect(await importVisits(db, file, "merge")).toEqual({
      added: 0,
      skipped: 2,
    });
    expect(await listVisits(db)).toHaveLength(2);
  });

  it("上書き: 既存の訪問をすべて削除し、ファイルの内容だけにする（重複判定はしない）", async () => {
    const { db } = await openMigrated();
    await addVisit(db, {
      municipalityCode: "13101",
      visitedOn: "2026-01-01",
      memo: null,
      source: "manual",
      placeName: "千代田区",
    });
    await addVisit(db, {
      municipalityCode: "13104",
      visitedOn: "2026-10-12",
      memo: null,
      source: "town",
      placeName: "西新宿",
    });

    const result = await importVisits(
      db,
      [transferVisit({}), transferVisit({ placeName: "新宿" })],
      "overwrite",
    );

    expect(result).toEqual({ added: 2, skipped: 0 });
    expect((await listVisits(db)).map((v) => v.placeName).sort()).toEqual([
      "新宿",
      "西新宿",
    ]);
    expect(await countVisitsByMunicipality(db)).toEqual([
      { municipalityCode: "13104", visitCount: 2 },
    ]);
  });

  it("上書き: 空のファイルなら、訪問は0件になる", async () => {
    const { db } = await openMigrated();
    await addVisit(db, {
      municipalityCode: "13101",
      visitedOn: "2026-01-01",
      memo: null,
      source: "manual",
      placeName: "千代田区",
    });

    expect(await importVisits(db, [], "overwrite")).toEqual({
      added: 0,
      skipped: 0,
    });
    expect(await listVisits(db)).toEqual([]);
  });

  it("createdAt / updatedAt が無い行には、取り込んだ時刻を入れる", async () => {
    jest.useFakeTimers({ now: new Date("2026-11-15T03:00:00.000Z") });
    try {
      const { db } = await openMigrated();
      await importVisits(
        db,
        [
          transferVisit({ createdAt: null, updatedAt: null }),
          transferVisit({
            placeName: "新宿",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: null,
          }),
        ],
        "merge",
      );
      const visits = await listVisits(db);
      expect(visits.find((v) => v.placeName === "西新宿")).toMatchObject({
        createdAt: "2026-11-15T03:00:00.000Z",
        updatedAt: "2026-11-15T03:00:00.000Z",
      });
      expect(visits.find((v) => v.placeName === "新宿")).toMatchObject({
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it.each(["merge", "overwrite"] as const)(
    "%s: 途中で失敗したら全体を取り消し、元の訪問がそのまま残る",
    async (mode) => {
      const { db } = await openMigrated();
      await addVisit(db, {
        municipalityCode: "13101",
        visitedOn: "2026-01-01",
        memo: "残る",
        source: "manual",
        placeName: "千代田区",
      });
      const before = await listVisits(db);

      await expect(
        importVisits(
          db,
          [
            transferVisit({}),
            // source の CHECK 制約に反する行（検証をすり抜けた想定）
            transferVisit({
              placeName: "壊れた行",
              source: "other" as TransferVisit["source"],
            }),
          ],
          mode,
        ),
      ).rejects.toThrow(/CHECK constraint failed/);

      expect(await listVisits(db)).toEqual(before);
    },
  );
});
