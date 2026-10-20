import {
  findMunicipalityByCode,
  MUNICIPALITIES,
} from "../src/data/municipalities";

// 要件の49区市（23区＋26市）。マスタとは別に、総務省の全国地方公共団体コードから
// 書き起こした期待値。マスタの誤字・コード違いを検出するために独立して持つ。
const EXPECTED: ReadonlyArray<readonly [code: string, name: string]> = [
  ["13101", "千代田区"],
  ["13102", "中央区"],
  ["13103", "港区"],
  ["13104", "新宿区"],
  ["13105", "文京区"],
  ["13106", "台東区"],
  ["13107", "墨田区"],
  ["13108", "江東区"],
  ["13109", "品川区"],
  ["13110", "目黒区"],
  ["13111", "大田区"],
  ["13112", "世田谷区"],
  ["13113", "渋谷区"],
  ["13114", "中野区"],
  ["13115", "杉並区"],
  ["13116", "豊島区"],
  ["13117", "北区"],
  ["13118", "荒川区"],
  ["13119", "板橋区"],
  ["13120", "練馬区"],
  ["13121", "足立区"],
  ["13122", "葛飾区"],
  ["13123", "江戸川区"],
  ["13201", "八王子市"],
  ["13202", "立川市"],
  ["13203", "武蔵野市"],
  ["13204", "三鷹市"],
  ["13205", "青梅市"],
  ["13206", "府中市"],
  ["13207", "昭島市"],
  ["13208", "調布市"],
  ["13209", "町田市"],
  ["13210", "小金井市"],
  ["13211", "小平市"],
  ["13212", "日野市"],
  ["13213", "東村山市"],
  ["13214", "国分寺市"],
  ["13215", "国立市"],
  ["13218", "福生市"],
  ["13219", "狛江市"],
  ["13220", "東大和市"],
  ["13221", "清瀬市"],
  ["13222", "東久留米市"],
  ["13223", "武蔵村山市"],
  ["13224", "多摩市"],
  ["13225", "稲城市"],
  ["13227", "羽村市"],
  ["13228", "あきる野市"],
  ["13229", "西東京市"],
];

describe("区市マスタ", () => {
  const wards = MUNICIPALITIES.filter((m) => m.type === "ward");
  const cities = MUNICIPALITIES.filter((m) => m.type === "city");

  it("49件ちょうどで、区が23件・市が26件", () => {
    expect(MUNICIPALITIES).toHaveLength(49);
    expect(wards).toHaveLength(23);
    expect(cities).toHaveLength(26);
  });

  it("type は ward か city のどちらか", () => {
    for (const m of MUNICIPALITIES) {
      expect(["ward", "city"]).toContain(m.type);
    }
  });

  it("code は5桁の 13xxx で、重複がない", () => {
    const codes = MUNICIPALITIES.map((m) => m.code);
    for (const code of codes) {
      expect(code).toMatch(/^13\d{3}$/);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("区は 131xx、市は 132xx で、code の昇順に並んでいる", () => {
    for (const m of wards) {
      expect(m.code).toMatch(/^131\d{2}$/);
    }
    for (const m of cities) {
      expect(m.code).toMatch(/^132\d{2}$/);
    }
    const codes = MUNICIPALITIES.map((m) => m.code);
    expect(codes).toEqual([...codes].sort());
  });

  it("町村（133xx〜）や島しょ部（136xx〜）のコードを含まない", () => {
    for (const m of MUNICIPALITIES) {
      expect(Number(m.code)).toBeLessThan(13300);
    }
  });

  it("name に重複がなく、末尾の区／市が type と一致する", () => {
    const names = MUNICIPALITIES.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    for (const m of MUNICIPALITIES) {
      expect(m.name.slice(-1)).toBe(m.type === "ward" ? "区" : "市");
    }
  });

  it("kana はひらがなと長音だけでできていて、name の末尾に対応する「く」「し」で終わる", () => {
    for (const m of MUNICIPALITIES) {
      expect(m.kana).toMatch(/^[ぁ-ゖー]+$/);
      expect(m.kana.slice(-1)).toBe(m.type === "ward" ? "く" : "し");
    }
  });

  it("コードと名称の組が、要件の49区市と完全に一致する", () => {
    expect(MUNICIPALITIES.map((m) => [m.code, m.name])).toEqual(EXPECTED);
  });
});

describe("findMunicipalityByCode", () => {
  it("マスタにあるコードなら、その区市を返す", () => {
    expect(findMunicipalityByCode("13104")).toEqual(
      expect.objectContaining({ code: "13104", name: "新宿区" }),
    );
    expect(findMunicipalityByCode("13229")?.name).toBe("西東京市");
  });

  it.each(["13301", "13100", "1310", "", "13104 "])(
    "マスタにないコード %p は undefined",
    (code) => {
      expect(findMunicipalityByCode(code)).toBeUndefined();
    },
  );
});
