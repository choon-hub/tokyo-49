import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import * as SQLite from "expo-sqlite";

import { DICT_VERSION } from "../src/data/dict-version";
import { MUNICIPALITIES } from "../src/data/municipalities";
import {
  DICT_DB_NAME,
  openDictDb,
  readDictVersion,
  shouldReplaceDict,
} from "../src/db/dict-db";
import { searchCandidates } from "../src/db/dict-search";
import { USER_DB_NAME } from "../src/db/user-db";
import { openTestDatabase } from "../test-utils/node-sqlite";

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
  importDatabaseFromAssetAsync: jest.fn(),
}));

const mockOpen = jest.mocked(SQLite.openDatabaseAsync);
const mockImport = jest.mocked(SQLite.importDatabaseFromAssetAsync);

const SCHEMA = readFileSync(
  join(__dirname, "..", "scripts", "build-data", "schema.sql"),
  "utf8",
);

/** 指定した版の（中身は空の）辞書。版が null なら、まだ辞書をコピーしていない空の DB。 */
function fakeDict(version: number | null) {
  const { db, raw } = openTestDatabase();
  if (version !== null) {
    raw.exec(SCHEMA);
    raw
      .prepare("INSERT INTO meta (key, value) VALUES ('dict_version', ?)")
      .run(String(version));
  }
  const closeAsync = jest.fn(async () => {});
  return { db: Object.assign(db, { closeAsync }), closeAsync };
}

beforeEach(() => {
  mockOpen.mockReset();
  mockImport.mockReset();
  mockImport.mockResolvedValue();
});

describe("辞書の版の比較", () => {
  it("辞書 DB のファイルは dict.db で、user.db とは別", () => {
    expect(DICT_DB_NAME).toBe("dict.db");
    expect(DICT_DB_NAME).not.toBe(USER_DB_NAME);
  });

  it("端末内に辞書が無ければ入れ替える", () => {
    expect(shouldReplaceDict(null, 1)).toBe(true);
  });

  it("同梱版のほうが新しいときだけ入れ替える", () => {
    expect(shouldReplaceDict(1, 2)).toBe(true);
    expect(shouldReplaceDict(2, 2)).toBe(false);
    expect(shouldReplaceDict(3, 2)).toBe(false);
    // 文字列の大小ではなく数値で比べる
    expect(shouldReplaceDict(9, 10)).toBe(true);
  });

  it("meta.dict_version を数値で読む。meta が無い・値が数値でないときは null", async () => {
    expect(await readDictVersion(fakeDict(7).db)).toBe(7);
    expect(await readDictVersion(fakeDict(null).db)).toBeNull();

    const broken = openTestDatabase();
    broken.raw.exec(SCHEMA);
    broken.raw.exec(
      "INSERT INTO meta (key, value) VALUES ('dict_version', 'abc')",
    );
    expect(await readDictVersion(broken.db)).toBeNull();
  });
});

describe("openDictDb", () => {
  it("初回起動（辞書なし）は、同梱の辞書を dict.db に上書きコピーしてから開き直す", async () => {
    const empty = fakeDict(null);
    const copied = fakeDict(DICT_VERSION);
    mockOpen.mockResolvedValueOnce(empty.db).mockResolvedValueOnce(copied.db);

    const db = await openDictDb();

    expect(db).toBe(copied.db);
    // コピーの前に、開いていた DB を閉じる
    expect(empty.closeAsync).toHaveBeenCalledTimes(1);
    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockImport).toHaveBeenCalledWith("dict.db", {
      assetId: expect.anything(),
      forceOverwrite: true,
    });
    expect(mockOpen.mock.calls.map((call) => call[0])).toEqual([
      "dict.db",
      "dict.db",
    ]);
  });

  it("端末内の辞書が古ければ、丸ごと入れ替える", async () => {
    const old = fakeDict(DICT_VERSION - 1);
    const copied = fakeDict(DICT_VERSION);
    mockOpen.mockResolvedValueOnce(old.db).mockResolvedValueOnce(copied.db);

    expect(await openDictDb()).toBe(copied.db);
    expect(old.closeAsync).toHaveBeenCalledTimes(1);
    expect(mockImport).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["同じ版", DICT_VERSION],
    ["新しい版", DICT_VERSION + 1],
  ])("端末内の辞書が%sなら、コピーせずそのまま使う", async (_label, version) => {
    const installed = fakeDict(version);
    mockOpen.mockResolvedValueOnce(installed.db);

    expect(await openDictDb()).toBe(installed.db);
    expect(mockImport).not.toHaveBeenCalled();
    expect(installed.closeAsync).not.toHaveBeenCalled();
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("辞書の入れ替えで触るのは dict.db だけ（user.db は開きもコピーもしない）", async () => {
    mockOpen
      .mockResolvedValueOnce(fakeDict(null).db)
      .mockResolvedValueOnce(fakeDict(DICT_VERSION).db);

    await openDictDb();

    const touched = [
      ...mockOpen.mock.calls.map((call) => call[0]),
      ...mockImport.mock.calls.map((call) => call[0]),
    ];
    expect(touched).not.toContain(USER_DB_NAME);
    expect(new Set(touched)).toEqual(new Set(["dict.db"]));
  });
});

// 同梱している辞書そのものの最小限の確認。中身の網羅的な検証はしない（要件書 v0.2-14）。
describe("同梱の dict.db", () => {
  const raw = new DatabaseSync(
    join(__dirname, "..", "assets", "dict", "dict.db"),
    { readOnly: true },
  );
  afterAll(() => raw.close());

  const db = {
    async getAllAsync(sql: string, params: string[] = []) {
      return raw.prepare(sql).all(...params);
    },
    async getFirstAsync(sql: string, params: string[] = []) {
      return raw.prepare(sql).get(...params) ?? null;
    },
  } as unknown as SQLite.SQLiteDatabase;

  const search = async (input: string) =>
    (await searchCandidates(db, input)).candidates.map(
      (c) => `${c.source}:${c.name}:${c.municipalityName}`,
    );

  it("meta.dict_version は、アプリが持つ同梱版の番号と同じ", async () => {
    expect(await readDictVersion(db)).toBe(DICT_VERSION);
  });

  it("municipalities は49区市のマスタと一致する", () => {
    expect(
      raw.prepare("SELECT code, name, kana, type FROM municipalities ORDER BY code").all(),
    ).toEqual(MUNICIPALITIES.map((m) => ({ ...m })));
  });

  it("駅も町域も、区市コードは49区市のものだけ", () => {
    const codes = new Set(MUNICIPALITIES.map((m) => m.code));
    for (const table of ["stations", "towns"]) {
      const used = raw
        .prepare(`SELECT DISTINCT municipality_code AS code FROM ${table}`)
        .all() as { code: string }[];
      expect(used.length).toBeGreaterThan(0);
      expect(used.filter((row) => !codes.has(row.code))).toEqual([]);
    }
  });

  it("「上野」で上野駅（台東区）が出る。駅名と所在地が違う目黒駅は品川区", async () => {
    expect(await search("上野")).toContain("station:上野:台東区");
    expect(await search("目黒")).toContain("station:目黒:品川区");
  });

  it("区境の新宿駅は新宿区の1件にまとまっている", async () => {
    expect(
      (await search("新宿")).filter((c) => c.startsWith("station:新宿:")),
    ).toEqual(["station:新宿:新宿区"]);
  });

  it("「しんじゅく」「シンジュク」「新宿」のどれでも新宿駅が出る", async () => {
    for (const input of ["しんじゅく", "シンジュク", "新宿"]) {
      expect(await search(input)).toContain("station:新宿:新宿区");
    }
  });

  it("「西新宿」は新宿区の町域として、「本町」は複数の区市の候補として入っている", async () => {
    expect(await search("西新宿")).toContain("town:西新宿:新宿区");
    const honcho = (await search("本町")).filter((c) =>
      c.startsWith("town:本町:"),
    );
    expect(honcho.length).toBeGreaterThan(1);
    expect(honcho).toContain("town:本町:渋谷区");
    expect(honcho).toContain("town:本町:中野区");
  });

  it("KEN_ALL のノイズ行（以下に掲載がない場合・括弧書き・ビルの階）は入っていない", () => {
    expect(
      raw
        .prepare(
          `SELECT name FROM towns
            WHERE name LIKE '%以下に掲載がない場合%' OR name LIKE '%（%' OR name LIKE '%(%' OR name LIKE '%階'`,
        )
        .all(),
    ).toEqual([]);
  });

  it("同じ町域名＋区市コード、同じ駅名＋区市コードの重複がない", () => {
    for (const table of ["stations", "towns"]) {
      expect(
        raw
          .prepare(
            `SELECT name, municipality_code FROM ${table}
              GROUP BY name, municipality_code HAVING COUNT(*) > 1`,
          )
          .all(),
      ).toEqual([]);
    }
  });

  it("1文字の入力では30件に切られ、全ヒット件数はそれより多い", async () => {
    const result = await searchCandidates(db, "あ");
    expect(result.candidates).toHaveLength(30);
    expect(result.total).toBeGreaterThan(30);
  });
});
