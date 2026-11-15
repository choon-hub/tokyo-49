import { memo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { G, Path } from "react-native-svg";

import { type MapPalette, useMapPalette } from "../../theme/map-palette";
import { useTheme } from "../../theme/use-theme";
import { MAP_SHAPES, MAP_SIZE, WARDS_BOUNDS } from "../data/map-shapes";
import {
  clampTransform,
  fitBounds,
  hitTest,
  panBy,
  toMapPoint,
  zoomAt,
  type MapTransform,
  type ScaleLimits,
  type Size,
} from "../lib/map-geometry";

type Props = {
  /** 訪問済みの区市コード */
  visitedCodes: ReadonlySet<string>;
  /** 区市をタップしたとき */
  onPressMunicipality: (code: string) => void;
};

type View2D = {
  viewport: Size;
  transform: MapTransform;
  limits: ScaleLimits;
  // ジェスチャは開始からの累積値を渡してくるので、前回の値を覚えておいて差分を使う。
  // ドラッグとピンチは同時に進むため、それぞれの差分を1つの変換に積み重ねる。
  lastPan: { x: number; y: number };
  lastPinchScale: number;
};

/** 枠の大きさから初期表示（23区ズーム）を作る。 */
function initialView(viewport: Size): View2D {
  return {
    viewport,
    ...fitBounds(WARDS_BOUNDS, MAP_SIZE, viewport),
    lastPan: { x: 0, y: 0 },
    lastPinchScale: 1,
  };
}

/** 変換を差し替える。地図が枠の外へ出ないよう、必ず範囲内に収める。 */
function withTransform(view: View2D, transform: MapTransform): View2D {
  return {
    ...view,
    transform: clampTransform(transform, MAP_SIZE, view.viewport, view.limits),
  };
}

// 49区市の地図。訪問済みを塗り分け、ピンチ・ドラッグで拡大と移動ができる。
// 初期表示は23区で、市部へはドラッグで移動する。右上のボタンで初期表示に戻せる。
export function TokyoMap({ visitedCodes, onPressMunicipality }: Props) {
  const theme = useTheme();
  const palette = useMapPalette();
  // 枠の大きさが分かるまでは描かない。
  const [view, setView] = useState<View2D | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setView((current) =>
      current &&
      current.viewport.width === width &&
      current.viewport.height === height
        ? current
        : initialView({ width, height }),
    );
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      setView((current) => current && { ...current, lastPan: { x: 0, y: 0 } });
    })
    .onUpdate((event) => {
      const { translationX, translationY } = event;
      setView(
        (current) =>
          current && {
            ...withTransform(
              current,
              panBy(
                current.transform,
                translationX - current.lastPan.x,
                translationY - current.lastPan.y,
              ),
            ),
            lastPan: { x: translationX, y: translationY },
          },
      );
    })
    .withTestId("map-pan");

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      setView((current) => current && { ...current, lastPinchScale: 1 });
    })
    .onUpdate((event) => {
      const { scale, focalX, focalY } = event;
      setView(
        (current) =>
          current && {
            ...withTransform(
              current,
              zoomAt(
                current.transform,
                focalX,
                focalY,
                scale / current.lastPinchScale,
                current.limits,
              ),
            ),
            lastPinchScale: scale,
          },
      );
    })
    .withTestId("map-pinch");

  // ドラッグやピンチにならなかったタッチだけを、区市のタップとして扱う。
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(10)
    .onEnd((event, success) => {
      if (!success || !view) return;
      const point = toMapPoint(view.transform, event.x, event.y);
      const code = hitTest(MAP_SHAPES, point.x, point.y);
      if (code) onPressMunicipality(code);
    })
    .withTestId("map-tap");

  const gesture = Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          onLayout={handleLayout}
          style={[styles.map, { backgroundColor: palette.background }]}
          testID="tokyo-map"
        >
          {view && (
            <Svg width={view.viewport.width} height={view.viewport.height}>
              <G
                transform={`translate(${view.transform.x} ${view.transform.y}) scale(${view.transform.scale})`}
                testID="map-layer"
              >
                <MapShapes visitedCodes={visitedCodes} palette={palette} />
              </G>
            </Svg>
          )}
        </View>
      </GestureDetector>
      {/* 地図のジェスチャに巻き込まれないよう、ボタンは地図の枠の外（上）に重ねる。 */}
      <Pressable
        role="button"
        accessibilityLabel="地図を初期表示に戻す"
        onPress={() => setView((current) => current && initialView(current.viewport))}
        style={[
          styles.reset,
          { backgroundColor: theme.background, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.resetLabel, { color: theme.text }]}>
          リセット
        </Text>
      </Pressable>
    </View>
  );
}

// 区市の形は変換のたびに描き直す必要がないので、訪問状況か配色が変わったときだけ作り直す。
const MapShapes = memo(function MapShapes({
  visitedCodes,
  palette,
}: {
  visitedCodes: ReadonlySet<string>;
  palette: MapPalette;
}) {
  return MAP_SHAPES.map((shape) => (
    <Path
      key={shape.code}
      d={shape.path}
      fill={visitedCodes.has(shape.code) ? palette.visited : palette.unvisited}
      stroke={palette.border}
      strokeWidth={1}
      strokeLinejoin="round"
      // 拡大しても境界線は太らせない。
      vectorEffect="non-scaling-stroke"
      testID={`map-shape-${shape.code}`}
    />
  ));
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    overflow: "hidden",
  },
  reset: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  resetLabel: {
    fontSize: 14,
    fontWeight: "bold",
  },
});
