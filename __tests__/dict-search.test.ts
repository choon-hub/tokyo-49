import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CANDIDATE_LIMIT,
  candidateLabel,
  candidatePlaceName,
  searchCandidates,
} from "../src/db/dict-search";
import {
  escapeLike,
  normalizeKana,
  normalizeName,
} from "../src/lib/search-normalize";
import { openTestDatabase } from "../test-utils/node-sqlite";

describe("入力の正規化（要件書 §6）", () => {
  it("前後の空白と末尾の「駅」を除く", () => {
    expect(normalizeName("  上野駅 ")).toBe("上野");
    expect(normalizeName("上野 駅")).toBe("上野");
    expect(normalizeName("駅")).toBe("");
    expect(normalizeName("　")).toBe("");
  });

  it("途中の「駅」は残す", () => {
    expect(normalizeName("王子駅前")).toBe("王子駅前");
  });

  it("全角英数・半角カナを NFKC でそろえる", () => {
    expect(normalizeName("羽田空港第１ターミナル")).toBe("羽田空港第1ターミナル");
    expect(normalizeName("ｼﾝｼﾞｭｸ")).toBe("シンジュク");
  });

  it("読み用は、カタカナ（全角・半角）をひらがなにする", () => {
    expect(normalizeKana("シンジュク")).toBe("しんじゅく");
    expect(normalizeKana("ｼﾝｼﾞｭｸ駅")).toBe("しんじゅく");
    expect(normalizeKana("しんじゅく")).toBe("しんじゅく");
    expect(normalizeKana("新宿")).toBe("新宿");
    // 長音記号はそのまま
    expect(normalizeKana("ターミナル")).toBe("たーみなる");
  });

  it("表記ゆれ（ヶ／ケ）はそろえない", () => {
    expect(normalizeName("霞ケ関")).toBe("霞ケ関");
    expect(normalizeName("霞ヶ関")).toBe("霞ヶ関");
  });

  it("LIKE のワイルドカードとエスケープ文字をエスケープする", () => {
    expect(escapeLike("100%_!")).toBe("100!%!_!!");
    expect(escapeLike("上野")).toBe("上野");
  });
});

// 要件書 §5.1 のスキーマで、小さな辞書を作る。
function openDict() {
  const { db, raw } = openTestDatabase();
  raw.exec(
    readFileSync(
      join(__dirname, "..", "scripts", "build-data", "schema.sql"),
      "utf8",
    ),
  );
  raw.exec(`
INSERT INTO municipalities (code, name, kana, type) VALUES
  ('13104', '新宿区', 'しんじゅくく', 'ward'),
  ('13106', '台東区', 'たいとうく', 'ward'),
  ('13109', '品川区', 'しながわく', 'ward'),
  ('13113', '渋谷区', 'しぶやく', 'ward'),
  ('13114', '中野区', 'なかのく', 'ward');
INSERT INTO stations (id, name, kana, municipality_code, lines) VALUES
  (1, '上野', 'うえの', '13106', '山手線'),
  (2, '上野広小路', 'うえのひろこうじ', '13106', '銀座線'),
  (3, '新宿', 'しんじゅく', '13104', '山手線'),
  (4, '西新宿', 'にししんじゅく', '13104', '丸ノ内線'),
  (5, '天王洲アイル', 'てんのうずあいる', '13109', 'りんかい線'),
  (6, '読みなし', '', '13104', NULL),
  (7, '100%駅', 'ひゃくぱーせんと', '13104', NULL);
INSERT INTO towns (id, name, kana, municipality_code) VALUES
  (1, '上野', 'うえの', '13106'),
  (2, '上野公園', 'うえのこうえん', '13106'),
  (3, '西新宿', 'にししんじゅく', '13104'),
  (4, '新宿', 'しんじゅく', '13104'),
  (5, '本町', 'ほんまち', '13113'),
  (6, '本町', 'ほんちょう', '13114'),
  (7, '東上野', 'ひがしうえの', '13106');
`);
  return { db, raw };
}

const labels = async (input: string) =>
  (await searchCandidates(openDict().db, input)).candidates.map(candidateLabel);

describe("searchCandidates", () => {
  it("駅名の前方一致で、区市つきの候補を返す（末尾の「駅」つきでも同じ）", async () => {
    const { db } = openDict();
    const result = await searchCandidates(db, "上野広");

    expect(result).toEqual({
      candidates: [
        {
          source: "station",
          id: 2,
          name: "上野広小路",
          municipalityCode: "13106",
          municipalityName: "台東区",
        },
      ],
      total: 1,
    });
    expect((await searchCandidates(db, "上野広小路駅")).candidates).toEqual(
      result.candidates,
    );
  });

  it("駅を町域より先に並べ、「上野駅（台東区）」「上野公園（台東区）」の形で表示する", async () => {
    expect(await labels("上野")).toEqual([
      "上野駅（台東区）",
      "上野広小路駅（台東区）",
      "上野（台東区）",
      "上野公園（台東区）",
    ]);
  });

  it("部分一致はしない（「東上野」は「上野」で出ない、「新宿」で「西新宿」は出ない）", async () => {
    expect(await labels("上野")).not.toContain("東上野（台東区）");
    expect(await labels("新宿")).toEqual(["新宿駅（新宿区）", "新宿（新宿区）"]);
  });

  it("同名の町域は、区市名を併記して区市ごとに出す", async () => {
    expect(await labels("本町")).toEqual([
      "本町（渋谷区）",
      "本町（中野区）",
    ]);
  });

  it("ひらがな・全角カタカナ・半角カタカナ・漢字のどれでも同じ候補になる", async () => {
    const expected = ["新宿駅（新宿区）", "新宿（新宿区）"];
    expect(await labels("しんじゅく")).toEqual(expected);
    expect(await labels("シンジュク")).toEqual(expected);
    expect(await labels("ｼﾝｼﾞｭｸ")).toEqual(expected);
    expect(await labels("新宿")).toEqual(expected);
  });

  it("読みも前方一致だけ（「しんじゅく」で「にししんじゅく」は出ない）", async () => {
    expect(await labels("しんじ")).toEqual([
      "新宿駅（新宿区）",
      "新宿（新宿区）",
    ]);
    expect(await labels("じゅく")).toEqual([]);
  });

  it("名前にカタカナを含む駅は、名前どおりの入力でも読みでも出る", async () => {
    const expected = ["天王洲アイル駅（品川区）"];
    expect(await labels("天王洲アイル")).toEqual(expected);
    expect(await labels("天王洲ア")).toEqual(expected);
    expect(await labels("てんのうずあいる")).toEqual(expected);
    expect(await labels("テンノウズ")).toEqual(expected);
  });

  it("読みのない駅は、読みでは出ないが名前では出る", async () => {
    expect(await labels("読み")).toEqual(["読みなし駅（新宿区）"]);
  });

  it("辞書にない入力（施設名・都外の駅）は候補なし", async () => {
    const { db } = openDict();
    expect(await searchCandidates(db, "東京ドーム")).toEqual({
      candidates: [],
      total: 0,
    });
    expect(await searchCandidates(db, "横浜駅")).toEqual({
      candidates: [],
      total: 0,
    });
  });

  it("空・空白だけ・「駅」だけの入力では、検索せずに候補なしを返す", async () => {
    const { db } = openDict();
    const getAll = jest.spyOn(db, "getAllAsync");
    for (const input of ["", "  ", "　", "駅"]) {
      expect(await searchCandidates(db, input)).toEqual({
        candidates: [],
        total: 0,
      });
    }
    expect(getAll).not.toHaveBeenCalled();
  });

  it("% や _ はワイルドカードとして働かない", async () => {
    expect(await labels("%")).toEqual([]);
    expect(await labels("_")).toEqual([]);
    expect(await labels("上_")).toEqual([]);
    expect(await labels("100%")).toEqual(["100%駅駅（新宿区）"]);
  });

  it("候補は最大30件で、total は上限で切る前の全ヒット件数", async () => {
    const { db, raw } = openDict();
    const insertStation = raw.prepare(
      "INSERT INTO stations (name, kana, municipality_code) VALUES (?, ?, '13104')",
    );
    const insertTown = raw.prepare(
      "INSERT INTO towns (name, kana, municipality_code) VALUES (?, ?, '13104')",
    );
    for (let i = 0; i < 20; i++) {
      insertStation.run(`あ駅${String(i).padStart(2, "0")}`, "あ");
    }
    for (let i = 0; i < 25; i++) {
      insertTown.run(`あ町${String(i).padStart(2, "0")}`, "あ");
    }

    const result = await searchCandidates(db, "あ");

    expect(CANDIDATE_LIMIT).toBe(30);
    expect(result.candidates).toHaveLength(30);
    expect(result.total).toBe(45);
    // 駅20件がすべて先に来て、残り10件が町域
    expect(result.candidates.map((c) => c.source)).toEqual([
      ...Array<string>(20).fill("station"),
      ...Array<string>(10).fill("town"),
    ]);
  });

  it("ちょうど30件なら total も30（「他N件」は出ない）", async () => {
    const { db, raw } = openDict();
    const insert = raw.prepare(
      "INSERT INTO towns (name, kana, municipality_code) VALUES (?, 'あ', '13104')",
    );
    for (let i = 0; i < 30; i++) insert.run(`あ町${i}`);

    const result = await searchCandidates(db, "あ");
    expect(result.candidates).toHaveLength(30);
    expect(result.total).toBe(30);
  });
});

describe("候補の表示名", () => {
  it("駅は「駅」を付け、町域は町域名のまま（区市は含めない）", () => {
    const base = {
      id: 1,
      municipalityCode: "13104",
      municipalityName: "新宿区",
    };
    expect(
      candidatePlaceName({ ...base, source: "station", name: "西新宿" }),
    ).toBe("西新宿駅");
    expect(candidatePlaceName({ ...base, source: "town", name: "西新宿" })).toBe(
      "西新宿",
    );
  });
});
