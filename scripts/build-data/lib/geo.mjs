// GeoJSON（経度・緯度）を扱う小さな道具。

/** 輪（[x, y] の配列）の中に点があるか（偶奇規則）。 */
export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Polygon / MultiPolygon を「ポリゴン（輪の配列）の配列」にそろえる。 */
export function polygonsOf(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`ポリゴンではありません: ${geometry.type}`);
}

/** ポリゴン（外周＋穴）の中に点があるか。 */
export function pointInPolygon(x, y, polygon) {
  if (!pointInRing(x, y, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(x, y, polygon[i])) return false;
  }
  return true;
}

export function bboxOfRing(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** LineString / MultiLineString / Point の全頂点の平均（駅の代表点）。 */
export function representativePoint(geometry) {
  const points =
    geometry.type === "Point"
      ? [geometry.coordinates]
      : geometry.type === "LineString"
        ? geometry.coordinates
        : geometry.type === "MultiLineString"
          ? geometry.coordinates.flat()
          : null;
  if (!points || points.length === 0) {
    throw new Error(`代表点を求められません: ${geometry.type}`);
  }
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
}

/** 2点間のおおよその距離（メートル）。近距離の比較にだけ使う。 */
export function distanceMeters([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const x = (lon2 - lon1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}
