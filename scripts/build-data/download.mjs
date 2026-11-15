import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 辞書・地図の元データを取得して .cache/ に置く（.cache/ はコミットしない）。
// 通信するのはこのビルド用スクリプトだけで、アプリ本体は通信しない。
// 配布 URL と年度は変わるので、ここに固定して記録する。出典と利用条件は docs/data-sources.md。

export const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), ".cache");

// 東京都の49区市を含む範囲（Wikidata の座標検索に使う）。
const TOKYO_BOX = { west: 138.9, south: 35.45, east: 140.0, north: 35.95 };

const WIKIDATA_QUERY = `
SELECT ?item ?label ?kana ?coord WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord.
    bd:serviceParam wikibase:cornerSouthWest "Point(${TOKYO_BOX.west} ${TOKYO_BOX.south})"^^geo:wktLiteral;
                    wikibase:cornerNorthEast "Point(${TOKYO_BOX.east} ${TOKYO_BOX.north})"^^geo:wktLiteral.
  }
  ?item wdt:P1814 ?kana.
  ?item rdfs:label ?label.
  FILTER(LANG(?label) = "ja")
}`;

export const SOURCES = [
  {
    // 国土数値情報 行政区域データ（東京都・2025年1月1日時点）
    file: "N03.zip",
    url: "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_13_GML.zip",
  },
  {
    // 国土数値情報 鉄道データ（2024年度）
    file: "N02.zip",
    url: "https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-24/N02-24_GML.zip",
  },
  {
    // 日本郵便 郵便番号データ（UTF-8 版・全国一括）
    file: "ken_all.zip",
    url: "https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip",
  },
  {
    // Wikidata（CC0）: 東京周辺に座標があり「読み仮名」を持つ項目。駅の読みの補完に使う。
    file: "wikidata-kana.json",
    url: `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(WIKIDATA_QUERY)}`,
  },
];

/** 無いファイルだけ取得する。force なら取り直す。 */
export async function downloadSources({ force = false } = {}) {
  mkdirSync(CACHE_DIR, { recursive: true });
  for (const source of SOURCES) {
    const path = join(CACHE_DIR, source.file);
    if (!force && existsSync(path)) continue;
    console.log(`取得: ${source.file}`);
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "dict-build-script/1.0",
        Accept: source.file.endsWith(".json")
          ? "application/sparql-results+json"
          : "*/*",
      },
    });
    if (!response.ok) {
      throw new Error(`取得に失敗しました (${response.status}): ${source.url}`);
    }
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await downloadSources({ force: process.argv.includes("--force") });
}
