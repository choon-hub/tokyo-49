import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  within,
} from "expo-router/testing-library";

import { MUNICIPALITIES } from "../src/data/municipalities";
import { addVisit, countVisitsByMunicipality } from "../src/db/visits";

jest.mock("../src/db/visits", () => ({
  addVisit: jest.fn(),
  countVisitsByMunicipality: jest.fn(),
}));

jest.mock("@react-native-community/datetimepicker", () => ({
  DateTimePickerAndroid: { open: jest.fn() },
}));

const mockAddVisit = jest.mocked(addVisit);
const mockCount = jest.mocked(countVisitsByMunicipality);
const mockOpenPicker = jest.mocked(DateTimePickerAndroid.open);

// 時計は JST 2026-10-18 0:30（UTC では前日の 15:30）に固定する。
const NOW = new Date(2026, 9, 18, 0, 30);

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockAddVisit.mockReset();
  mockAddVisit.mockResolvedValue(1);
  mockCount.mockReset();
  mockCount.mockResolvedValue([]);
  mockOpenPicker.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

const saveButton = () => screen.getByRole("button", { name: "保存" });

async function openFromHome(initialUrl: "/" | "/list") {
  const router = renderRouter("./app", { initialUrl });
  fireEvent.press(await screen.findByRole("button", { name: "訪問を記録" }));
  expect(await screen.findByTestId("visit-new-screen")).toBeTruthy();
  return router;
}

describe("ホームからの導線", () => {
  it.each([
    ["地図タブ", "/" as const],
    ["一覧タブ", "/list" as const],
  ])("%sの「訪問を記録」で訪問入力画面に進む", async (_tab, initialUrl) => {
    const { getPathname } = await openFromHome(initialUrl);
    expect(getPathname()).toBe("/visit/new");
  });
});

describe("訪問入力画面", () => {
  it("49区市をマスタの順（JIS コード順）ですべて選択肢に出す", async () => {
    await openFromHome("/");
    const picker = within(screen.getByTestId("municipality-picker"));
    const names = picker
      .getAllByRole("radio")
      .map((node) => within(node).getByText(/./).props.children as string);
    expect(names).toHaveLength(49);
    expect(names).toEqual(MUNICIPALITIES.map((m) => m.name));
  });

  it("区市を選ぶまで保存できず、選ぶと選んだ区市が表示されて保存できる", async () => {
    await openFromHome("/");
    expect(screen.getByTestId("selected-municipality")).toHaveTextContent(
      "下の一覧から選んでください",
    );
    expect(saveButton()).toBeDisabled();

    fireEvent.press(saveButton());
    expect(mockAddVisit).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole("radio", { name: "渋谷区" }));
    expect(screen.getByTestId("selected-municipality")).toHaveTextContent(
      "渋谷区",
    );
    expect(screen.getByRole("radio", { name: "渋谷区" })).toBeSelected();
    expect(screen.getByRole("radio", { name: "新宿区" })).not.toBeSelected();
    expect(saveButton()).toBeEnabled();
  });

  it("訪問日の初期値は端末のローカル日付の今日（UTC では前日になる時刻でも）", async () => {
    await openFromHome("/");
    expect(screen.getByText("2026年10月18日（日）")).toBeTruthy();
  });

  it("日付ピッカーで過去日・未来日を選べる（最小日・最大日は指定しない）", async () => {
    await openFromHome("/");

    fireEvent.press(screen.getByRole("button", { name: "訪問日を変更" }));
    expect(mockOpenPicker).toHaveBeenCalledTimes(1);
    const options = mockOpenPicker.mock.calls[0][0];
    expect(options.mode).toBe("date");
    expect(options.minimumDate).toBeUndefined();
    expect(options.maximumDate).toBeUndefined();
    expect(options.value).toEqual(new Date(2026, 9, 18));

    act(() => {
      options.onChange?.(
        { type: "set", nativeEvent: { timestamp: 0, utcOffset: 540 } },
        new Date(2020, 1, 29),
      );
    });
    expect(screen.getByText("2020年2月29日（土）")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "訪問日を変更" }));
    act(() => {
      mockOpenPicker.mock.calls[1][0].onChange?.(
        { type: "set", nativeEvent: { timestamp: 0, utcOffset: 540 } },
        new Date(2030, 0, 1),
      );
    });
    expect(screen.getByText("2030年1月1日（火）")).toBeTruthy();
  });

  it("ピッカーを閉じただけ（キャンセル）なら日付は変わらず、空にもならない", async () => {
    await openFromHome("/");
    fireEvent.press(screen.getByRole("button", { name: "訪問日を変更" }));
    act(() => {
      mockOpenPicker.mock.calls[0][0].onChange?.(
        { type: "dismissed", nativeEvent: { timestamp: 0, utcOffset: 540 } },
        undefined,
      );
    });
    expect(screen.getByText("2026年10月18日（日）")).toBeTruthy();
  });
});

describe("保存", () => {
  it("確認なしで addVisit を1回呼び、ホームに戻る（place_name は区市名、source は manual）", async () => {
    const { getPathname } = await openFromHome("/list");
    fireEvent.press(screen.getByRole("radio", { name: "西東京市" }));
    fireEvent.changeText(screen.getByLabelText("メモ"), "  駅前  ");

    fireEvent.press(saveButton());

    expect(await screen.findByTestId("list-screen")).toBeTruthy();
    expect(getPathname()).toBe("/list");
    expect(mockAddVisit).toHaveBeenCalledTimes(1);
    expect(mockAddVisit).toHaveBeenCalledWith(expect.anything(), {
      municipalityCode: "13229",
      visitedOn: "2026-10-18",
      memo: "  駅前  ",
      source: "manual",
      placeName: "西東京市",
    });
  });

  it("一覧から保存して戻ると、再起動しなくてもチェックと制覇数が更新される", async () => {
    // 保存前は未訪問、保存後の集計は西東京市が1件
    mockCount
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ municipalityCode: "13229", visitCount: 1 }]);
    await openFromHome("/list");
    expect(mockCount).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole("radio", { name: "西東京市" }));
    fireEvent.press(saveButton());

    expect(await screen.findByText("1 / 49")).toBeTruthy();
    expect(mockCount).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("西東京市 訪問済み")).toBeTruthy();
    expect(screen.getByLabelText("千代田区 未訪問")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(1);
  });

  it("メモが空のままでも保存できる", async () => {
    const { getPathname } = await openFromHome("/");
    fireEvent.press(screen.getByRole("radio", { name: "千代田区" }));
    fireEvent.press(saveButton());

    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(getPathname()).toBe("/");
    expect(mockAddVisit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ municipalityCode: "13101", memo: "" }),
    );
  });

  it("保存の処理中に連打しても addVisit は1回だけ", async () => {
    let finish: (id: number) => void = () => {};
    mockAddVisit.mockImplementation(
      () => new Promise<number>((resolve) => (finish = resolve)),
    );
    await openFromHome("/");
    fireEvent.press(screen.getByRole("radio", { name: "港区" }));

    fireEvent.press(saveButton());
    fireEvent.press(saveButton());
    fireEvent.press(saveButton());
    expect(mockAddVisit).toHaveBeenCalledTimes(1);

    await act(async () => finish(1));
    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(mockAddVisit).toHaveBeenCalledTimes(1);
  });

  it("保存に失敗したら画面に留まって知らせ、もう一度保存できる", async () => {
    mockAddVisit.mockRejectedValueOnce(new Error("disk full"));
    const { getPathname } = await openFromHome("/");
    fireEvent.press(screen.getByRole("radio", { name: "港区" }));

    fireEvent.press(saveButton());
    expect(
      await screen.findByText("保存できませんでした。もう一度お試しください。"),
    ).toBeTruthy();
    expect(getPathname()).toBe("/visit/new");
    expect(saveButton()).toBeEnabled();

    fireEvent.press(saveButton());
    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(mockAddVisit).toHaveBeenCalledTimes(2);
  });
});
