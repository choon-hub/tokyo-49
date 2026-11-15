import { router } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  within,
} from "expo-router/testing-library";
import * as RN from "react-native";
import { State } from "react-native-gesture-handler";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";
import { G, Path } from "react-native-svg";

import { MAP_SHAPES, MAP_SIZE, WARDS_BOUNDS } from "../src/data/map-shapes";
import { MUNICIPALITIES } from "../src/data/municipalities";
import {
  countVisitsByMunicipality,
  listVisitsByMunicipality,
} from "../src/db/visits";
import { containsPoint, fitBounds } from "../src/lib/map-geometry";
import { darkMapPalette, lightMapPalette } from "../theme/map-palette";

jest.mock("../src/db/visits", () => ({
  countVisitsByMunicipality: jest.fn(),
  listVisitsByMunicipality: jest.fn(),
}));

const mockCount = jest.mocked(countVisitsByMunicipality);
const mockList = jest.mocked(listVisitsByMunicipality);
const colorScheme = jest.spyOn(RN, "useColorScheme");

// 地図の枠の大きさ（縦長のスマホ）
const VIEWPORT = { width: 400, height: 600 };
const INITIAL = fitBounds(WARDS_BOUNDS, MAP_SIZE, VIEWPORT).transform;

beforeEach(() => {
  mockCount.mockReset();
  mockCount.mockResolvedValue([]);
  mockList.mockReset();
  mockList.mockResolvedValue([]);
  colorScheme.mockReset();
  colorScheme.mockReturnValue("light");
});

/** 地図タブを開き、枠の大きさを伝えて地図を描かせる。 */
async function renderMap() {
  const result = renderRouter("./app", { initialUrl: "/" });
  await screen.findByTestId("map-screen");
  fireEvent(screen.getByTestId("tokyo-map"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, ...VIEWPORT } },
  });
  await act(async () => {});
  return result;
}

const shapes = () => screen.UNSAFE_getAllByType(Path);
const fillOf = (code: string) =>
  shapes().find((path) => path.props.testID === `map-shape-${code}`)?.props
    .fill as string | undefined;
const layerTransform = () =>
  screen
    .UNSAFE_getAllByType(G)
    .find((layer) => layer.props.testID === "map-layer")?.props.transform as
    | string
    | undefined;

const transformString = (t: { x: number; y: number; scale: number }) =>
  `translate(${t.x} ${t.y}) scale(${t.scale})`;

/** 区市の内側にある地図座標の点。 */
function pointInside(code: string) {
  const shape = MAP_SHAPES.find((s) => s.code === code);
  if (!shape) throw new Error(`地図に無い区市: ${code}`);
  const ring = shape.polygons[0][0];
  const xs = ring.filter((_, i) => i % 2 === 0);
  const ys = ring.filter((_, i) => i % 2 === 1);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  for (let i = 1; i < 20; i++) {
    for (let j = 1; j < 20; j++) {
      const x = minX + ((maxX - minX) * i) / 20;
      const y = minY + ((maxY - minY) * j) / 20;
      if (containsPoint(shape.polygons, x, y)) return { x, y };
    }
  }
  throw new Error("内側の点が見つからない");
}

/** 地図座標の点を、いまの変換で画面座標にしてタップする。 */
function tapMapPoint(
  point: { x: number; y: number },
  transform = INITIAL,
) {
  act(() => {
    fireGestureHandler(getByGestureTestId("map-tap"), [
      {
        x: point.x * transform.scale + transform.x,
        y: point.y * transform.scale + transform.y,
      },
    ]);
  });
}

describe("地図タブの表示", () => {
  it("49区市をすべて描き、訪問のない間は全部が未訪問の色", async () => {
    await renderMap();

    expect(shapes().map((path) => path.props.testID)).toEqual(
      MUNICIPALITIES.map((m) => `map-shape-${m.code}`),
    );
    for (const m of MUNICIPALITIES) {
      expect(fillOf(m.code)).toBe(lightMapPalette.unvisited);
    }
  });

  it("訪問のある区市だけを訪問済みの色で塗る（回数による濃淡はない）", async () => {
    mockCount.mockResolvedValue([
      { municipalityCode: "13104", visitCount: 1 },
      { municipalityCode: "13229", visitCount: 12 },
    ]);
    await renderMap();

    expect(fillOf("13104")).toBe(lightMapPalette.visited);
    expect(fillOf("13229")).toBe(lightMapPalette.visited);
    expect(fillOf("13101")).toBe(lightMapPalette.unvisited);
    expect(
      MUNICIPALITIES.filter(
        (m) => fillOf(m.code) === lightMapPalette.visited,
      ),
    ).toHaveLength(2);
  });

  it("制覇数 / 49 を地図タブにも出す", async () => {
    mockCount.mockResolvedValue([{ municipalityCode: "13104", visitCount: 3 }]);
    await renderMap();

    expect(
      within(screen.getByTestId("map-screen")).getByRole("heading"),
    ).toHaveTextContent("1 / 49");
  });

  it("別の画面から地図タブに戻ると、集計を読み直して塗り直す", async () => {
    await renderMap();
    expect(fillOf("13104")).toBe(lightMapPalette.unvisited);

    mockCount.mockResolvedValue([{ municipalityCode: "13104", visitCount: 1 }]);
    fireEvent.press(screen.getByText("一覧"));
    expect(await screen.findByTestId("list-screen")).toBeTruthy();
    fireEvent.press(screen.getByText("地図"));
    await act(async () => {});

    expect(fillOf("13104")).toBe(lightMapPalette.visited);
  });

  it("集計に失敗したら日本語のエラーを出し、地図は表示したまま", async () => {
    mockCount.mockRejectedValue(new Error("disk I/O error"));
    await renderMap();

    expect(
      within(screen.getByTestId("map-screen")).getByRole("alert"),
    ).toHaveTextContent(/訪問記録を読み込めませんでした/);
    expect(shapes()).toHaveLength(49);
  });

  it("初期表示は23区にズームした状態", async () => {
    await renderMap();
    expect(layerTransform()).toBe(transformString(INITIAL));
  });

  it("枠の大きさが分かるまでは描かない", async () => {
    renderRouter("./app", { initialUrl: "/" });
    await screen.findByTestId("map-screen");
    expect(screen.UNSAFE_queryAllByType(Path)).toHaveLength(0);
  });
});

describe("地図の配色（専用パレット）", () => {
  it.each([
    ["light", lightMapPalette],
    ["dark", darkMapPalette],
  ] as const)(
    "%s では、塗り・境界線・背景にそのテーマの地図パレットを使う",
    async (scheme, palette) => {
      colorScheme.mockReturnValue(scheme);
      mockCount.mockResolvedValue([
        { municipalityCode: "13104", visitCount: 1 },
      ]);
      await renderMap();

      expect(fillOf("13104")).toBe(palette.visited);
      expect(fillOf("13101")).toBe(palette.unvisited);
      for (const path of shapes()) {
        expect(path.props.stroke).toBe(palette.border);
      }
      expect(screen.getByTestId("tokyo-map")).toHaveStyle({
        backgroundColor: palette.background,
      });
    },
  );
});

describe("区市のタップ", () => {
  it("区市の上をタップすると、その区市のシートが開く（未訪問でも開く）", async () => {
    const { getPathname } = await renderMap();

    tapMapPoint(pointInside("13104"));

    expect(await screen.findByTestId("municipality-sheet")).toBeTruthy();
    expect(getPathname()).toBe("/municipality/13104");
    expect(
      within(screen.getByTestId("municipality-sheet")).getByRole("heading"),
    ).toHaveTextContent("新宿区");
    expect(mockList).toHaveBeenCalledWith(expect.anything(), "13104");
    // 未訪問なので履歴は空で、同じシートから追記できる
    await act(async () => {});
    expect(
      within(screen.getByTestId("municipality-sheet")).getByRole("button", {
        name: "追記",
      }),
    ).toBeTruthy();
  });

  it("初期表示で見えている23区は、どの区をタップしてもその区のシートが開く", async () => {
    const { getPathname } = await renderMap();

    for (const m of MUNICIPALITIES.filter((m) => m.type === "ward")) {
      tapMapPoint(pointInside(m.code));
      expect(await screen.findByTestId("municipality-sheet")).toBeTruthy();
      expect(getPathname()).toBe(`/municipality/${m.code}`);
      // シートを閉じて地図に戻る
      act(() => router.back());
      await act(async () => {});
    }
  });

  it("区市のない場所（地図の外・海）をタップしても何も開かない", async () => {
    const { getPathname } = await renderMap();

    act(() => {
      fireGestureHandler(getByGestureTestId("map-tap"), [{ x: 399, y: 1 }]);
    });
    await act(async () => {});

    expect(getPathname()).toBe("/");
    expect(screen.queryByTestId("municipality-sheet")).toBeNull();
  });

  it("タップとして成立しなかったタッチ（ドラッグに変わった等）では開かない", async () => {
    const { getPathname } = await renderMap();
    const point = pointInside("13104");

    act(() => {
      fireGestureHandler(getByGestureTestId("map-tap"), [
        { state: State.BEGAN },
        {
          state: State.FAILED,
          x: point.x * INITIAL.scale + INITIAL.x,
          y: point.y * INITIAL.scale + INITIAL.y,
        },
      ]);
    });
    await act(async () => {});

    expect(getPathname()).toBe("/");
  });
});

describe("ドラッグ・ピンチ・リセット", () => {
  const pan = (dx: number, dy: number) =>
    act(() => {
      fireGestureHandler(getByGestureTestId("map-pan"), [
        { translationX: 0, translationY: 0 },
        { translationX: dx / 2, translationY: dy / 2 },
        { translationX: dx, translationY: dy },
      ]);
    });

  it("ドラッグした分だけ地図が動く", async () => {
    await renderMap();

    pan(60, 0);

    expect(layerTransform()).toBe(
      transformString({ ...INITIAL, x: INITIAL.x + 60 }),
    );
  });

  it("東へ大きくドラッグすると市部の西端まで届き、そこで止まる（範囲外には出ない）", async () => {
    await renderMap();

    pan(100000, 0);

    // 地図の左端が枠の左端にぴったり付く
    expect(layerTransform()).toBe(transformString({ ...INITIAL, x: 0 }));
  });

  it("ドラッグした後のタップは、動かした先の位置で区市を判定する", async () => {
    const { getPathname } = await renderMap();
    pan(100000, 0);
    // ジェスチャのコールバックは、描き直しの少し後（マイクロタスク）で新しいものに差し替わる。
    await act(async () => {});
    const moved = { ...INITIAL, x: 0 };

    // 西端の八王子市・青梅市の側が見えているので、八王子市をタップできる
    tapMapPoint(pointInside("13201"), moved);

    expect(await screen.findByTestId("municipality-sheet")).toBeTruthy();
    expect(getPathname()).toBe("/municipality/13201");
  });

  it("ピンチで拡大でき、指の中心の位置は動かない", async () => {
    await renderMap();

    act(() => {
      fireGestureHandler(getByGestureTestId("map-pinch"), [
        { scale: 1, focalX: 200, focalY: 300 },
        { scale: 2, focalX: 200, focalY: 300 },
      ]);
    });

    const scale = INITIAL.scale * 2;
    expect(layerTransform()).toBe(
      transformString({
        scale,
        x: 200 - (200 - INITIAL.x) * 2,
        y: 300 - (300 - INITIAL.y) * 2,
      }),
    );
  });

  it("リセットボタンは常に出ていて、押すと初期表示（23区ズーム）に戻る", async () => {
    await renderMap();
    const reset = () =>
      screen.getByRole("button", { name: "地図を初期表示に戻す" });
    expect(reset()).toBeTruthy();

    pan(100000, 50);
    act(() => {
      fireGestureHandler(getByGestureTestId("map-pinch"), [
        { scale: 1, focalX: 100, focalY: 100 },
        { scale: 3, focalX: 100, focalY: 100 },
      ]);
    });
    expect(layerTransform()).not.toBe(transformString(INITIAL));
    expect(reset()).toBeTruthy();

    fireEvent.press(reset());

    expect(layerTransform()).toBe(transformString(INITIAL));
  });

  it("リセットボタンを押しても、その下の区市のシートは開かない", async () => {
    const { getPathname } = await renderMap();

    fireEvent.press(
      screen.getByRole("button", { name: "地図を初期表示に戻す" }),
    );
    await act(async () => {});

    expect(getPathname()).toBe("/");
  });
});
