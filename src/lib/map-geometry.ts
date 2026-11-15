// 地図の座標計算。描画やジェスチャには依存しない。
// 「地図座標」は map-shapes.json の座標、「画面座標」は地図を表示する枠の左上を原点とする座標。

export type Size = { width: number; height: number };

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** 輪。x, y を交互に並べた配列（始点と終点は重ねない）。 */
export type Ring = readonly number[];
/** ポリゴン。先頭が外周で、残りは穴。 */
export type Polygon = readonly Ring[];

/** 地図座標 → 画面座標の変換。画面 = 地図 × scale + (x, y) */
export type MapTransform = { scale: number; x: number; y: number };

export type ScaleLimits = { min: number; max: number };

/** 初期表示からどこまで拡大できるか。 */
const MAX_ZOOM_FROM_INITIAL = 8;
/** 初期表示で、23区のまわりに残す余白（枠に対する割合）。 */
const INITIAL_PADDING = 0.04;

/** ポリゴンの集まりを SVG のパス（d 属性）にする。 */
export function polygonsToPath(polygons: readonly Polygon[]): string {
  const parts: string[] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      let d = `M${ring[0]} ${ring[1]}`;
      for (let i = 2; i < ring.length; i += 2) {
        d += `L${ring[i]} ${ring[i + 1]}`;
      }
      parts.push(`${d}Z`);
    }
  }
  return parts.join("");
}

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** 点がポリゴンの集まりの中にあるか（穴の中は外）。 */
export function containsPoint(
  polygons: readonly Polygon[],
  x: number,
  y: number,
): boolean {
  return polygons.some(
    (polygon) =>
      pointInRing(x, y, polygon[0]) &&
      !polygon.slice(1).some((hole) => pointInRing(x, y, hole)),
  );
}

/** 地図座標の点を含む区市のコード。どの区市でもなければ null。 */
export function hitTest(
  shapes: readonly { code: string; polygons: readonly Polygon[] }[],
  x: number,
  y: number,
): string | null {
  return shapes.find((s) => containsPoint(s.polygons, x, y))?.code ?? null;
}

/** 画面座標 → 地図座標 */
export function toMapPoint(
  transform: MapTransform,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: (x - transform.x) / transform.scale,
    y: (y - transform.y) / transform.scale,
  };
}

/** 拡大率の下限（地図全体が枠に収まる）と上限。 */
export function scaleLimits(
  map: Size,
  viewport: Size,
  initialScale: number,
): ScaleLimits {
  return {
    min: Math.min(viewport.width / map.width, viewport.height / map.height),
    max: initialScale * MAX_ZOOM_FROM_INITIAL,
  };
}

function clampAxis(offset: number, scaled: number, viewport: number): number {
  // 地図が枠より小さい方向は中央に寄せ、大きい方向は端が枠の内側に入らないようにする。
  if (scaled <= viewport) return (viewport - scaled) / 2;
  return Math.min(0, Math.max(viewport - scaled, offset));
}

/** 拡大率を上下限に収め、地図が枠の外へ出ていかないように位置を直す。 */
export function clampTransform(
  transform: MapTransform,
  map: Size,
  viewport: Size,
  limits: ScaleLimits,
): MapTransform {
  const scale = Math.min(limits.max, Math.max(limits.min, transform.scale));
  return {
    scale,
    x: clampAxis(transform.x, map.width * scale, viewport.width),
    y: clampAxis(transform.y, map.height * scale, viewport.height),
  };
}

/** bounds（地図座標）が枠の中央に収まる変換。初期表示（23区ズーム）に使う。 */
export function fitBounds(
  bounds: Bounds,
  map: Size,
  viewport: Size,
): { transform: MapTransform; limits: ScaleLimits } {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const scale =
    Math.min(viewport.width / width, viewport.height / height) *
    (1 - INITIAL_PADDING * 2);
  const limits = scaleLimits(map, viewport, scale);
  const transform = clampTransform(
    {
      scale,
      x: viewport.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
      y: viewport.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
    },
    map,
    viewport,
    limits,
  );
  return { transform, limits };
}

/** 画面座標の点 (focalX, focalY) を動かさずに、拡大率を ratio 倍する。上下限を超える分は無視する。 */
export function zoomAt(
  transform: MapTransform,
  focalX: number,
  focalY: number,
  ratio: number,
  limits: ScaleLimits,
): MapTransform {
  const scale = Math.min(
    limits.max,
    Math.max(limits.min, transform.scale * ratio),
  );
  const applied = scale / transform.scale;
  return {
    scale,
    x: focalX - (focalX - transform.x) * applied,
    y: focalY - (focalY - transform.y) * applied,
  };
}

/** 画面上で (dx, dy) だけ動かす。 */
export function panBy(
  transform: MapTransform,
  dx: number,
  dy: number,
): MapTransform {
  return { scale: transform.scale, x: transform.x + dx, y: transform.y + dy };
}
