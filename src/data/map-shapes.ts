import {
  polygonsToPath,
  type Bounds,
  type Polygon,
  type Size,
} from "../lib/map-geometry";
import raw from "./map-shapes.json";

// 49区市の地図の形。map-shapes.json は scripts/build-data/build.mjs が
// 国土数値情報（行政区域）から生成する（島しょ部は含まない）。

export type MapShape = {
  /** 区市コード（municipalities.ts と同じ） */
  code: string;
  polygons: readonly Polygon[];
  /** SVG のパス（d 属性） */
  path: string;
};

/** 地図全体の大きさ（地図座標）。 */
export const MAP_SIZE: Size = { width: raw.width, height: raw.height };

/** 23区を囲む矩形。初期表示（23区ズーム）に使う（Q17）。 */
export const WARDS_BOUNDS: Bounds = raw.wardsBounds;

export const MAP_SHAPES: readonly MapShape[] = raw.shapes.map((shape) => ({
  code: shape.code,
  polygons: shape.polygons,
  path: polygonsToPath(shape.polygons),
}));
