import { MAP_SHAPES, MAP_SIZE, WARDS_BOUNDS } from "../src/data/map-shapes";
import { MUNICIPALITIES } from "../src/data/municipalities";
import {
  clampTransform,
  containsPoint,
  fitBounds,
  hitTest,
  panBy,
  polygonsToPath,
  toMapPoint,
  zoomAt,
  type Polygon,
} from "../src/lib/map-geometry";
import { contrastRatio } from "../theme/contrast";
import { darkMapPalette, lightMapPalette } from "../theme/map-palette";
import { darkPalette, lightPalette } from "../theme/palette";

// 縦長のスマホを想定した地図の枠
const VIEWPORT = { width: 400, height: 600 };

/** ポリゴンの外周の内側にある点を1つ返す（外接矩形を走査して最初に当たった点）。 */
function pointInside(polygons: readonly Polygon[]): { x: number; y: number } {
  const ring = polygons[0][0];
  const xs = ring.filter((_, i) => i % 2 === 0);
  const ys = ring.filter((_, i) => i % 2 === 1);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  for (let i = 1; i < 20; i++) {
    for (let j = 1; j < 20; j++) {
      const x = minX + ((maxX - minX) * i) / 20;
      const y = minY + ((maxY - minY) * j) / 20;
      if (containsPoint(polygons, x, y)) return { x, y };
    }
  }
  throw new Error("内側の点が見つからない");
}

describe("同梱の地図データ", () => {
  it("49区市を過不足なく、マスタと同じコード順で持つ（島しょ部・町村は含まない）", () => {
    expect(MAP_SHAPES.map((s) => s.code)).toEqual(
      MUNICIPALITIES.map((m) => m.code),
    );
  });

  it("どの区市も、3点以上の外周を持つ描ける形になっている", () => {
    for (const shape of MAP_SHAPES) {
      expect(shape.polygons.length).toBeGreaterThan(0);
      for (const polygon of shape.polygons) {
        for (const ring of polygon) {
          expect(ring.length % 2).toBe(0);
          expect(ring.length).toBeGreaterThanOrEqual(6);
        }
      }
      expect(shape.path).toMatch(/^M[\d.]+ [\d.]+L.*Z$/);
    }
  });

  it("すべての頂点が地図の範囲に収まり、23区は地図の東側にある", () => {
    for (const shape of MAP_SHAPES) {
      for (const ring of shape.polygons.flat()) {
        for (let i = 0; i < ring.length; i += 2) {
          expect(ring[i]).toBeGreaterThanOrEqual(0);
          expect(ring[i]).toBeLessThanOrEqual(MAP_SIZE.width);
          expect(ring[i + 1]).toBeGreaterThanOrEqual(0);
          expect(ring[i + 1]).toBeLessThanOrEqual(MAP_SIZE.height);
        }
      }
    }
    expect(WARDS_BOUNDS.minX).toBeGreaterThan(MAP_SIZE.width / 2);
    expect(WARDS_BOUNDS.maxX).toBeLessThanOrEqual(MAP_SIZE.width);
  });

  it("スマホで軽く描ける量に簡略化されている（頂点は合計1万個未満）", () => {
    const points = MAP_SHAPES.flatMap((s) => s.polygons.flat()).reduce(
      (sum, ring) => sum + ring.length / 2,
      0,
    );
    expect(points).toBeLessThan(10000);
  });

  it("小さな区も潰れずに、タップできる面積を持つ（内側の点がその区市に当たる）", () => {
    for (const shape of MAP_SHAPES) {
      const inside = pointInside(shape.polygons);
      expect(hitTest(MAP_SHAPES, inside.x, inside.y)).toBe(shape.code);
    }
  });
});

describe("polygonsToPath / hitTest", () => {
  const square: Polygon = [[0, 0, 10, 0, 10, 10, 0, 10]];
  const withHole: Polygon = [
    [20, 0, 40, 0, 40, 20, 20, 20],
    [25, 5, 35, 5, 35, 15, 25, 15],
  ];

  it("輪ごとに M…L…Z でつないだパスにする", () => {
    expect(polygonsToPath([square])).toBe("M0 0L10 0L10 10L0 10Z");
    expect(polygonsToPath([square, withHole])).toBe(
      "M0 0L10 0L10 10L0 10ZM20 0L40 0L40 20L20 20ZM25 5L35 5L35 15L25 15Z",
    );
  });

  it("内側の点は当たり、外側と穴の中は当たらない", () => {
    const shapes = [
      { code: "a", polygons: [square] },
      { code: "b", polygons: [withHole] },
    ];
    expect(hitTest(shapes, 5, 5)).toBe("a");
    expect(hitTest(shapes, 22, 10)).toBe("b");
    expect(hitTest(shapes, 30, 10)).toBeNull();
    expect(hitTest(shapes, 15, 5)).toBeNull();
    expect(hitTest(shapes, -1, -1)).toBeNull();
  });
});

describe("初期表示（23区ズーム）", () => {
  const { transform, limits } = fitBounds(WARDS_BOUNDS, MAP_SIZE, VIEWPORT);

  const toScreen = (x: number, y: number) => ({
    x: x * transform.scale + transform.x,
    y: y * transform.scale + transform.y,
  });

  it("23区全体が枠の中に収まる", () => {
    const topLeft = toScreen(WARDS_BOUNDS.minX, WARDS_BOUNDS.minY);
    const bottomRight = toScreen(WARDS_BOUNDS.maxX, WARDS_BOUNDS.maxY);
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(topLeft.y).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(VIEWPORT.width);
    expect(bottomRight.y).toBeLessThanOrEqual(VIEWPORT.height);
  });

  it("23区が枠の幅か高さの大半を占める（地図全体の表示より拡大されている）", () => {
    const width = (WARDS_BOUNDS.maxX - WARDS_BOUNDS.minX) * transform.scale;
    const height = (WARDS_BOUNDS.maxY - WARDS_BOUNDS.minY) * transform.scale;
    expect(
      Math.max(width / VIEWPORT.width, height / VIEWPORT.height),
    ).toBeGreaterThan(0.85);
    expect(transform.scale).toBeGreaterThan(limits.min);
  });

  it("市部の西端は、初期表示では枠の外にある（ドラッグで移動して見る）", () => {
    expect(toScreen(0, 0).x).toBeLessThan(0);
  });

  it("画面座標と地図座標を行き来できる", () => {
    const screen = toScreen(700, 300);
    const map = toMapPoint(transform, screen.x, screen.y);
    expect(map.x).toBeCloseTo(700, 6);
    expect(map.y).toBeCloseTo(300, 6);
  });
});

describe("ドラッグと拡大の制限", () => {
  const { transform: initial, limits } = fitBounds(
    WARDS_BOUNDS,
    MAP_SIZE,
    VIEWPORT,
  );
  const clamp = (t: Parameters<typeof clampTransform>[0]) =>
    clampTransform(t, MAP_SIZE, VIEWPORT, limits);

  it("東へ大きくドラッグすると、市部の西端（八王子・青梅方面）が枠の左端に来て止まる", () => {
    const moved = clamp(panBy(initial, 100000, 0));
    // 地図の左端が枠の左端にぴったり付き、それ以上は動かない
    expect(moved.x).toBe(0);
    expect(moved.scale).toBe(initial.scale);
  });

  it("どの方向へどれだけドラッグしても、地図は枠の外へ出ていかない", () => {
    for (const [dx, dy] of [
      [100000, 0],
      [-100000, 0],
      [0, 100000],
      [0, -100000],
      [-100000, -100000],
      [100000, 100000],
    ]) {
      const moved = clamp(panBy(initial, dx, dy));
      const width = MAP_SIZE.width * moved.scale;
      const height = MAP_SIZE.height * moved.scale;
      if (width > VIEWPORT.width) {
        // 枠より大きい方向は、端が枠の内側に入らない
        expect(moved.x).toBeLessThanOrEqual(0);
        expect(moved.x + width).toBeGreaterThanOrEqual(VIEWPORT.width);
      } else {
        // 枠より小さい方向は、中央に置く
        expect(moved.x).toBeCloseTo((VIEWPORT.width - width) / 2, 6);
      }
      if (height > VIEWPORT.height) {
        expect(moved.y).toBeLessThanOrEqual(0);
        expect(moved.y + height).toBeGreaterThanOrEqual(VIEWPORT.height);
      } else {
        expect(moved.y).toBeCloseTo((VIEWPORT.height - height) / 2, 6);
      }
    }
  });

  it("範囲内のドラッグは、動かした分だけそのまま動く", () => {
    const moved = clamp(panBy(initial, 50, 0));
    expect(moved.x).toBeCloseTo(initial.x + 50, 6);
  });

  it("ピンチでは、指の中心にある地点が動かない", () => {
    const focal = { x: 200, y: 300 };
    const before = toMapPoint(initial, focal.x, focal.y);
    const zoomed = zoomAt(initial, focal.x, focal.y, 2, limits);
    const after = toMapPoint(zoomed, focal.x, focal.y);
    expect(zoomed.scale).toBeCloseTo(initial.scale * 2, 6);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("拡大は上限まで、縮小は地図全体が枠に収まるところまで", () => {
    const zoomedIn = clamp(zoomAt(initial, 200, 300, 1000, limits));
    expect(zoomedIn.scale).toBe(limits.max);
    expect(limits.max).toBeGreaterThan(initial.scale * 4);

    const zoomedOut = clamp(zoomAt(initial, 200, 300, 0.001, limits));
    expect(zoomedOut.scale).toBe(limits.min);
    // 地図全体が枠に収まっている
    expect(MAP_SIZE.width * zoomedOut.scale).toBeLessThanOrEqual(
      VIEWPORT.width + 1e-6,
    );
    expect(MAP_SIZE.height * zoomedOut.scale).toBeLessThanOrEqual(
      VIEWPORT.height + 1e-6,
    );
    expect(zoomedOut.x).toBeCloseTo(0, 6);
  });
});

describe("地図のパレット（ライト／ダーク）", () => {
  it.each([
    ["ライト", lightMapPalette, lightPalette],
    ["ダーク", darkMapPalette, darkPalette],
  ])(
    "%s: 訪問済み・未訪問・境界線・背景の4色を持ち、互いに見分けられる",
    (_name, map, common) => {
      expect(Object.keys(map).sort()).toEqual([
        "background",
        "border",
        "unvisited",
        "visited",
      ]);
      for (const color of Object.values(map)) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/);
      }
      // 訪問済みと未訪問は、図形どうしの基準（WCAG 1.4.11 の 3:1）以上
      expect(contrastRatio(map.visited, map.unvisited)).toBeGreaterThanOrEqual(
        4,
      );
      // 境界線は、どちらの塗りの上でも見える
      expect(contrastRatio(map.border, map.unvisited)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(map.border, map.visited)).toBeGreaterThanOrEqual(3);
      // 区市の塗りは、地図の背景に埋もれない
      expect(contrastRatio(map.visited, map.background)).toBeGreaterThanOrEqual(
        3,
      );
      expect(
        contrastRatio(map.unvisited, map.background),
      ).toBeGreaterThanOrEqual(1.2);
      // 地図専用の配色で、共通テーマの色を流用していない
      expect(map.background).not.toBe(common.background);
    },
  );

  it("ライトとダークで別の配色になっている", () => {
    for (const key of ["visited", "unvisited", "border", "background"] as const) {
      expect(lightMapPalette[key]).not.toBe(darkMapPalette[key]);
    }
  });
});
