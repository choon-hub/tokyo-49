import { migrateUserDb, USER_DB_NAME } from "../src/db/user-db";
import { openTestDatabase } from "../test-utils/node-sqlite";

const userVersion = (raw: ReturnType<typeof openTestDatabase>["raw"]) =>
  (raw.prepare("PRAGMA user_version").get() as { user_version: number })
    .user_version;

describe("user.db のマイグレーション", () => {
  it("DB のファイル名は user.db（辞書の dict.db とは別）", () => {
    expect(USER_DB_NAME).toBe("user.db");
  });

  it("新しい DB に v1 を適用し、user_version が 1 になる", async () => {
    const { db, raw } = openTestDatabase();
    expect(userVersion(raw)).toBe(0);

    await migrateUserDb(db);

    expect(userVersion(raw)).toBe(1);
  });

  it("visits の列は要件書 §5.2 の DDL と一致する", async () => {
    const { db, raw } = openTestDatabase();
    await migrateUserDb(db);

    const columns = raw
      .prepare("PRAGMA table_info(visits)")
      .all()
      .map((c) => [c.name, c.type, c.notnull, c.pk]);
    expect(columns).toEqual([
      ["id", "INTEGER", 0, 1],
      ["place_name", "TEXT", 1, 0],
      ["municipality_code", "TEXT", 1, 0],
      ["source", "TEXT", 1, 0],
      ["ref_id", "INTEGER", 0, 0],
      ["visited_on", "TEXT", 1, 0],
      ["memo", "TEXT", 0, 0],
      ["created_at", "TEXT", 1, 0],
      ["updated_at", "TEXT", 1, 0],
    ]);

    // AUTOINCREMENT（sqlite_sequence が作られる）
    const table = raw
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'visits'")
      .get() as { sql: string };
    expect(table.sql).toMatch(/id INTEGER PRIMARY KEY AUTOINCREMENT/);

    // 外部キーは持たない（§5）
    expect(raw.prepare("PRAGMA foreign_key_list(visits)").all()).toEqual([]);
  });

  it("municipality_code のインデックス idx_visits_muni がある", async () => {
    const { db, raw } = openTestDatabase();
    await migrateUserDb(db);

    const indexColumns = raw
      .prepare("PRAGMA index_info(idx_visits_muni)")
      .all()
      .map((c) => c.name);
    expect(indexColumns).toEqual(["municipality_code"]);
  });

  it("source の CHECK 制約で station / town / manual 以外を拒否する", async () => {
    const { db, raw } = openTestDatabase();
    await migrateUserDb(db);

    const insert = raw.prepare(
      `INSERT INTO visits (place_name, municipality_code, source, visited_on, created_at, updated_at)
       VALUES ('新宿区', '13104', ?, '2026-10-18', 'x', 'x')`,
    );
    for (const source of ["station", "town", "manual"]) {
      expect(() => insert.run(source)).not.toThrow();
    }
    expect(() => insert.run("other")).toThrow(/CHECK constraint failed/);
  });

  it("もう一度実行しても冪等で、DDL を流し直さない", async () => {
    const { db, raw } = openTestDatabase();
    await migrateUserDb(db);
    raw.exec(
      `INSERT INTO visits (place_name, municipality_code, source, visited_on, created_at, updated_at)
       VALUES ('新宿区', '13104', 'manual', '2026-10-18', 'x', 'x')`,
    );

    const exec = jest.spyOn(db, "execAsync");
    const transaction = jest.spyOn(db, "withExclusiveTransactionAsync");
    await migrateUserDb(db);

    expect(exec).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(userVersion(raw)).toBe(1);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM visits").get()).toEqual(
      expect.objectContaining({ n: 1 }),
    );
  });
});
