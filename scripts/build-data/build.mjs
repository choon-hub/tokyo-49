import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { CACHE_DIR, downloadSources } from "./download.mjs";
import {
  bboxOfRing,
  distanceMeters,
  pointInPolygon,
  polygonsOf,
  representativePoint,
} from "./lib/geo.mjs";
import { toHiragana } from "./lib/kana.mjs";
import { readZipEntries } from "./lib/zip.mjs";
// 49区市のマスタはアプリ側の固定データを正とする（Node 24 は型注釈を外して読める）。
import { MUNICIPALITIES } from "../../src/data/municipalities.ts";

// 辞書（assets/dict/dict.db）と地図（src/data/map-shapes.json）を元データから作り直す。
//   npm run build:data            … 無い元データだけ取得して生成
//   npm run build:data -- --force … 元データを取り直して生成
// Node 22.5 以上が必要（node:sqlite を使う）。

// 辞書の中身が変わったら必ず上げる。端末内の辞書は、この版が新しいときだけ差し替わる。
// 中身が変わったのに上げ忘れると、このスクリプトが失敗する。
const DICT_VERSION = 1;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const DICT_DB_PATH = join(ROOT, "assets", "dict", "dict.db");
const DICT_VERSION_PATH = join(ROOT, "src", "data", "dict-version.ts");
const MAP_SHAPES_PATH = join(ROOT, "src", "data", "map-shapes.json");

const CODES = new Set(MUNICIPALITIES.map((m) => m.code));

function readFromZip(zipFile, pattern) {
  const entries = readZipEntries(readFileSync(join(CACHE_DIR, zipFile)));
  const entry = entries.find((e) => pattern.test(e.name));
  if (!entry) throw new Error(`${zipFile} に ${pattern} がありません`);
  return entry.read();
}

// ---------------------------------------------------------------------------
// 行政区域（N03）
// ---------------------------------------------------------------------------

function loadAreas() {
  const geojson = JSON.parse(readFromZip("N03.zip", /\.geojson$/).toString());
  /** 区市判定用: 簡略化していないポリゴンと、その外接矩形 */
  const polygons = [];
  const names = new Map();
  for (const feature of geojson.features) {
    const code = feature.properties.N03_007;
    if (!CODES.has(code)) continue;
    names.set(code, feature.properties.N03_004);
    for (const polygon of polygonsOf(feature.geometry)) {
      polygons.push({ code, polygon, bbox: bboxOfRing(polygon[0]) });
    }
  }

  // マスタと N03 の区市がずれていたら止める。
  for (const m of MUNICIPALITIES) {
    if (names.get(m.code) !== m.name) {
      throw new Error(
        `マスタと N03 が一致しません: ${m.code} ${m.name} / ${names.get(m.code)}`,
      );
    }
  }
  return { geojson, polygons };
}

function findMunicipalityCode(polygons, [x, y]) {
  for (const { code, polygon, bbox } of polygons) {
    if (x < bbox.minX || x > bbox.maxX || y < bbox.minY || y > bbox.maxY) {
      continue;
    }
    if (pointInPolygon(x, y, polygon)) return code;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 駅（N02 ＋ Wikidata の読み）
// ---------------------------------------------------------------------------

// 読みの突き合わせでだけ「ヶ」と「ケ」を同じに扱う（辞書に入れる駅名は N02 のまま）。
const kanaLookupKey = (name) => name.replace(/ヶ/g, "ケ");

function loadStationKana() {
  const json = JSON.parse(
    readFileSync(join(CACHE_DIR, "wikidata-kana.json"), "utf8"),
  );
  /** 駅名（「駅」なし）→ 候補 [{ kana, point }] */
  const byName = new Map();
  for (const row of json.results.bindings) {
    // 「新宿駅」「日本橋駅 (東京都)」「面影橋停留場」の形だけを駅として扱う。
    const label = /^(.+?)(駅|停留場)(?:\s*[(（].*[)）])?$/.exec(
      row.label.value.normalize("NFKC"),
    );
    const coord = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(row.coord.value);
    if (!label || !coord) continue;
    // 読みの末尾に付いた「えき」「ていりゅうじょう」は駅名の読みではないので除く。
    const suffix = label[2] === "駅" ? /えき$/ : /ていりゅうじょう$/;
    const kana = toHiragana(row.kana.value).replace(suffix, "").trim();
    // ひらがな（と長音記号）だけの読みに限る。
    if (!/^[ぁ-ゖー]+$/.test(kana)) continue;
    const key = kanaLookupKey(label[1]);
    const candidates = byName.get(key) ?? [];
    candidates.push({ kana, point: [Number(coord[1]), Number(coord[2])] });
    byName.set(key, candidates);
  }
  return byName;
}

// 同名の別の駅（都外など）の読みを拾わないよう、この距離までの項目だけ使う。
const KANA_MATCH_RADIUS_METERS = 3000;

function buildStations(polygons, overrides, manualKana) {
  const geojson = JSON.parse(
    readFromZip("N02.zip", /UTF-8\/.*_Station\.geojson$/).toString(),
  );

  /** `${name}\t${code}` → { name, code, lines, points } */
  const groups = new Map();
  for (const feature of geojson.features) {
    // 検索では入力を NFKC にそろえるので、辞書の名前も NFKC にしておく
    // （互換漢字の「塚」「練」や全角数字が、入力と一致しなくなるのを防ぐ）。
    const name = feature.properties.N02_005.normalize("NFKC");
    const point = representativePoint(feature.geometry);
    const located = findMunicipalityCode(polygons, point);
    if (!located) continue; // 49区市の外
    const code = overrides[name] ?? located;
    if (!CODES.has(code)) {
      throw new Error(`overrides.json の区市コードが不正です: ${name} → ${code}`);
    }
    const key = `${name}\t${code}`;
    const group = groups.get(key) ?? {
      name,
      code,
      lines: new Set(),
      points: [],
    };
    group.lines.add(feature.properties.N02_003);
    group.points.push(point);
    groups.set(key, group);
  }
  for (const name of [...Object.keys(overrides), ...Object.keys(manualKana)]) {
    if (![...groups.values()].some((g) => g.name === name)) {
      throw new Error(`overrides.json の駅が N02 にありません: ${name}`);
    }
  }

  const kanaByName = loadStationKana();
  const stations = [...groups.values()]
    .map((group) => {
      const center = [
        group.points.reduce((sum, p) => sum + p[0], 0) / group.points.length,
        group.points.reduce((sum, p) => sum + p[1], 0) / group.points.length,
      ];
      // 手動の読み（overrides.json の stationKana）があれば、それを優先する。
      let kana = manualKana[group.name] ?? "";
      let best = kana === "" ? KANA_MATCH_RADIUS_METERS : 0;
      for (const candidate of kanaByName.get(kanaLookupKey(group.name)) ??
        []) {
        const distance = distanceMeters(center, candidate.point);
        if (distance < best) {
          best = distance;
          kana = candidate.kana;
        }
      }
      return {
        name: group.name,
        kana,
        code: group.code,
        lines: [...group.lines].sort().join(","),
        center,
      };
    })
    .sort((a, b) =>
      a.name === b.name
        ? a.code.localeCompare(b.code)
        : a.name < b.name
          ? -1
          : 1,
    );

  // 同名で区市が分かれたままの駅。区境の同じ駅なら overrides.json で1つにまとめる。
  const split = new Map();
  for (const station of stations) {
    split.set(station.name, [...(split.get(station.name) ?? []), station]);
  }
  const unresolved = [...split.values()]
    .filter((list) => list.length > 1)
    .map((list) => ({
      name: list[0].name,
      codes: list.map((s) => s.code),
      meters: Math.round(distanceMeters(list[0].center, list[1].center)),
    }));

  return { stations, unresolved };
}

// ---------------------------------------------------------------------------
// 町域（KEN_ALL）
// ---------------------------------------------------------------------------

function parseCsvLine(line) {
  return [...line.matchAll(/"([^"]*)"|([^,]+)|(?<=,)(?=,)/g)].map(
    (m) => m[1] ?? m[2] ?? "",
  );
}

function buildTowns() {
  const lines = readFromZip("ken_all.zip", /\.csv$/i)
    .toString("utf8")
    .split(/\r?\n/);

  const seen = new Set();
  const towns = [];
  // 括弧書きが複数行に分かれた町域の、続きの行を読み飛ばすためのフラグ。
  let inOpenParen = false;
  for (const line of lines) {
    if (line === "") continue;
    const fields = parseCsvLine(line);
    const code = fields[0];
    const rawKana = fields[5];
    const rawName = fields[8];

    if (inOpenParen) {
      if (rawName.includes("）")) inOpenParen = false;
      continue;
    }
    if (rawName.includes("（") && !rawName.includes("）")) inOpenParen = true;

    if (!CODES.has(code)) continue;
    // ノイズ行
    if (rawName === "以下に掲載がない場合") continue;
    if (/の次に番地がくる場合|一円$/.test(rawName)) continue;
    // 高層ビルの階ごとの行（例: 西新宿新宿アイランドタワー（１階））
    if (/（.*階.*）/.test(rawName)) continue;

    const name = rawName.replace(/（.*$/, "").normalize("NFKC").trim();
    const kana = toHiragana(rawKana.replace(/[（(].*$/, "")).trim();
    if (name === "" || kana === "") continue;

    const key = `${name}\t${code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    towns.push({ name, kana, code });
  }
  return towns.sort((a, b) =>
    a.code !== b.code
      ? a.code.localeCompare(b.code)
      : a.kana !== b.kana
        ? a.kana < b.kana
          ? -1
          : 1
        : a.name < b.name
          ? -1
          : a.name > b.name
            ? 1
            : 0,
  );
}

// ---------------------------------------------------------------------------
// 辞書 DB
// ---------------------------------------------------------------------------

/** 辞書の中身から作る指紋。版の上げ忘れを見つけるために使う。 */
function contentHash(stations, towns) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(MUNICIPALITIES));
  hash.update(
    JSON.stringify(stations.map((s) => [s.name, s.kana, s.code, s.lines])),
  );
  hash.update(JSON.stringify(towns.map((t) => [t.name, t.kana, t.code])));
  return hash.digest("hex");
}

function assertVersionBumped(hash) {
  if (!existsSync(DICT_VERSION_PATH)) return;
  const previous = readFileSync(DICT_VERSION_PATH, "utf8");
  const version = Number(/DICT_VERSION = (\d+)/.exec(previous)?.[1]);
  const previousHash = /DICT_CONTENT_HASH =\s*"([0-9a-f]+)"/.exec(previous)?.[1];
  if (previousHash !== hash && version >= DICT_VERSION) {
    throw new Error(
      `辞書の中身が変わりました。build.mjs の DICT_VERSION を ${version + 1} 以上に上げてください。`,
    );
  }
  if (previousHash === hash && version !== DICT_VERSION) {
    throw new Error(
      `辞書の中身は変わっていません。DICT_VERSION は ${version} のままにしてください。`,
    );
  }
}

function writeDictDb(stations, towns) {
  const hash = contentHash(stations, towns);
  assertVersionBumped(hash);

  mkdirSync(dirname(DICT_DB_PATH), { recursive: true });
  rmSync(DICT_DB_PATH, { force: true });
  const db = new DatabaseSync(DICT_DB_PATH);
  db.exec(readFileSync(join(HERE, "schema.sql"), "utf8"));
  db.exec("BEGIN");
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run(
    "dict_version",
    String(DICT_VERSION),
  );
  const insertMunicipality = db.prepare(
    "INSERT INTO municipalities (code, name, kana, type) VALUES (?, ?, ?, ?)",
  );
  for (const m of MUNICIPALITIES) {
    insertMunicipality.run(m.code, m.name, m.kana, m.type);
  }
  const insertStation = db.prepare(
    "INSERT INTO stations (id, name, kana, municipality_code, lines) VALUES (?, ?, ?, ?, ?)",
  );
  stations.forEach((s, i) => {
    insertStation.run(i + 1, s.name, s.kana, s.code, s.lines);
  });
  const insertTown = db.prepare(
    "INSERT INTO towns (id, name, kana, municipality_code) VALUES (?, ?, ?, ?)",
  );
  towns.forEach((t, i) => {
    insertTown.run(i + 1, t.name, t.kana, t.code);
  });
  db.exec("COMMIT");
  db.exec("VACUUM");
  db.close();

  writeFileSync(
    DICT_VERSION_PATH,
    `// scripts/build-data/build.mjs が生成する。手で編集しない。

/** 同梱している dict.db の版（dict.db の meta.dict_version と同じ値）。 */
export const DICT_VERSION = ${DICT_VERSION};

/** 辞書の中身の指紋。版の上げ忘れを生成スクリプトが見つけるために使う。 */
export const DICT_CONTENT_HASH =
  "${hash}";
`,
  );
}

// ---------------------------------------------------------------------------
// 地図
// ---------------------------------------------------------------------------

const MAP_WIDTH = 1000;

function buildMapShapes(areasGeojson) {
  // 区市ごとにまとめてから、境界を共有したまま簡略化する（mapshaper）。
  const input = join(CACHE_DIR, "map-input.geojson");
  const output = join(CACHE_DIR, "map-simplified.geojson");
  writeFileSync(
    input,
    JSON.stringify({
      type: "FeatureCollection",
      features: areasGeojson.features.filter((f) =>
        CODES.has(f.properties.N03_007),
      ),
    }),
  );
  const require = createRequire(import.meta.url);
  const mapshaper = join(
    dirname(require.resolve("mapshaper/package.json")),
    "bin",
    "mapshaper",
  );
  execFileSync(
    process.execPath,
    [
      mapshaper,
      input,
      "-dissolve",
      "N03_007",
      // 小さな区の形が残る程度に間引く。keep-shapes で小さな飛び地も消さない。
      "-simplify",
      "weighted",
      "4%",
      "keep-shapes",
      // 埋立地の細かな破片は描いても見えないので落とす。
      "-filter-islands",
      "min-area=0.2km2",
      "-clean",
      "-o",
      "format=geojson",
      "precision=0.00001",
      output,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  const simplified = JSON.parse(readFileSync(output, "utf8"));

  // 経度・緯度 → 平面座標。経度方向を cos(緯度) で縮めて形のゆがみを抑え、幅を MAP_WIDTH にそろえる。
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const feature of simplified.features) {
    for (const polygon of polygonsOf(feature.geometry)) {
      const box = bboxOfRing(polygon[0]);
      west = Math.min(west, box.minX);
      east = Math.max(east, box.maxX);
      south = Math.min(south, box.minY);
      north = Math.max(north, box.maxY);
    }
  }
  const cos = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const scale = MAP_WIDTH / ((east - west) * cos);
  const round = (n) => Math.round(n * 10) / 10;
  const project = ([lon, lat]) => [
    round((lon - west) * cos * scale),
    round((north - lat) * scale),
  ];

  const shapes = simplified.features
    .map((feature) => {
      const polygons = polygonsOf(feature.geometry)
        .map((polygon) =>
          polygon
            .map((ring) => {
              const flat = [];
              for (const point of ring) {
                const [x, y] = project(point);
                const n = flat.length;
                // 丸めて同じ点になったものは重ねない。
                if (n >= 2 && flat[n - 2] === x && flat[n - 1] === y) continue;
                flat.push(x, y);
              }
              // GeoJSON の輪は始点と終点が同じ。終点は持たない。
              const n = flat.length;
              if (n >= 4 && flat[0] === flat[n - 2] && flat[1] === flat[n - 1]) {
                flat.length = n - 2;
              }
              return flat;
            })
            .filter((flat) => flat.length >= 6),
        )
        .filter((polygon) => polygon.length > 0);
      return { code: feature.properties.N03_007, polygons };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  if (
    shapes.length !== MUNICIPALITIES.length ||
    shapes.some((s) => !CODES.has(s.code) || s.polygons.length === 0)
  ) {
    throw new Error("地図の区市が49件そろっていません");
  }

  // 初期表示（23区ズーム）に使う、23区の外接矩形。
  const wards = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let pointCount = 0;
  for (const shape of shapes) {
    const isWard = shape.code < "13200";
    for (const polygon of shape.polygons) {
      for (const ring of polygon) {
        pointCount += ring.length / 2;
        if (!isWard) continue;
        for (let i = 0; i < ring.length; i += 2) {
          wards.minX = Math.min(wards.minX, ring[i]);
          wards.maxX = Math.max(wards.maxX, ring[i]);
          wards.minY = Math.min(wards.minY, ring[i + 1]);
          wards.maxY = Math.max(wards.maxY, ring[i + 1]);
        }
      }
    }
  }

  const map = {
    width: MAP_WIDTH,
    height: round((north - south) * scale),
    wardsBounds: wards,
    shapes,
  };
  writeFileSync(MAP_SHAPES_PATH, `${JSON.stringify(map)}\n`);
  return { pointCount, height: map.height };
}

// ---------------------------------------------------------------------------

await downloadSources({ force: process.argv.includes("--force") });

const overrides = JSON.parse(
  readFileSync(join(HERE, "overrides.json"), "utf8"),
);

const areas = loadAreas();
const { stations, unresolved } = buildStations(
  areas.polygons,
  overrides.stations,
  overrides.stationKana,
);
const towns = buildTowns();
writeDictDb(stations, towns);
const map = buildMapShapes(areas.geojson);

const withKana = stations.filter((s) => s.kana !== "").length;
console.log(`辞書の版: ${DICT_VERSION}`);
console.log(`駅: ${stations.length} 件（読みあり ${withKana} 件）`);
console.log(`町域: ${towns.length} 件`);
console.log(`地図: 1000 x ${map.height}、頂点 ${map.pointCount} 個`);
if (process.argv.includes("--report")) {
  console.log("読みのない駅:");
  console.log(
    stations
      .filter((s) => s.kana === "")
      .map((s) => s.name)
      .join(" "),
  );
}
if (unresolved.length > 0) {
  console.log(
    "同名で区市が分かれている駅（区境の同じ駅なら overrides.json に足す）:",
  );
  for (const u of unresolved) {
    console.log(`  ${u.name}: ${u.codes.join(" / ")}（約 ${u.meters} m）`);
  }
}
