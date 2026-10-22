import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  within,
} from "expo-router/testing-library";

import { MUNICIPALITIES } from "../src/data/municipalities";
import {
  addVisit,
  countVisitsByMunicipality,
  listVisitsByMunicipality,
  type Visit,
} from "../src/db/visits";

jest.mock("../src/db/visits", () => ({
  addVisit: jest.fn(),
  countVisitsByMunicipality: jest.fn(),
  listVisitsByMunicipality: jest.fn(),
}));

jest.mock("@react-native-community/datetimepicker", () => ({
  DateTimePickerAndroid: { open: jest.fn() },
}));

const mockAddVisit = jest.mocked(addVisit);
const mockCount = jest.mocked(countVisitsByMunicipality);
const mockList = jest.mocked(listVisitsByMunicipality);
const mockOpenPicker = jest.mocked(DateTimePickerAndroid.open);

const visit = (overrides: Partial<Visit>): Visit => ({
  id: 1,
  placeName: "新宿区",
  municipalityCode: "13104",
  source: "manual",
  refId: null,
  visitedOn: "2026-10-18",
  memo: null,
  createdAt: "2026-10-18T00:00:00.000Z",
  updatedAt: "2026-10-18T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  mockCount.mockReset();
  mockCount.mockResolvedValue([]);
  mockList.mockReset();
  mockList.mockResolvedValue([]);
  mockAddVisit.mockReset();
  mockAddVisit.mockResolvedValue(1);
  mockOpenPicker.mockReset();
});

const sheet = () => within(screen.getByTestId("municipality-sheet"));

// 一覧タブから区市の行を押してシートを開き、履歴の読み込みが反映されるまで待つ。
async function openFromList(label: string) {
  const result = renderRouter("./app", { initialUrl: "/list" });
  fireEvent.press(await screen.findByRole("button", { name: label }));
  expect(await screen.findByTestId("municipality-sheet")).toBeTruthy();
  await act(async () => {});
  return result;
}

describe("一覧からシートを開く", () => {
  it("行を押すと /municipality/<code> に進み、見出しに区市名が出て、その区市の履歴を読む", async () => {
    const { getPathname } = await openFromList("新宿区 未訪問");

    expect(getPathname()).toBe("/municipality/13104");
    expect(sheet().getByRole("heading")).toHaveTextContent("新宿区");
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledWith(expect.anything(), "13104");
  });

  it("49区市のどの行からも、その区市のシートが開く", async () => {
    const { getPathname } = renderRouter("./app", { initialUrl: "/list" });
    await screen.findByTestId("list-screen");
    await act(async () => {});

    for (const m of MUNICIPALITIES) {
      fireEvent.press(screen.getByRole("button", { name: `${m.name} 未訪問` }));
      expect(await screen.findByTestId("municipality-sheet")).toBeTruthy();
      await act(async () => {});
      expect(getPathname()).toBe(`/municipality/${m.code}`);
      expect(sheet().getByRole("heading")).toHaveTextContent(m.name);
      expect(mockList).toHaveBeenLastCalledWith(expect.anything(), m.code);

      act(() => router.back());
      await act(async () => {});
      expect(screen.queryByTestId("municipality-sheet")).toBeNull();
    }
    expect(mockList).toHaveBeenCalledTimes(MUNICIPALITIES.length);
  });
});

describe("履歴の表示", () => {
  it("受け取った順（新しい順）に、場所名・「2026年10月18日（日）」形式の訪問日・メモを出す", async () => {
    mockList.mockResolvedValue([
      // 未来日の訪問も、そのまま表示する
      visit({ id: 4, visitedOn: "2099-12-31", memo: "未来の予定" }),
      visit({ id: 3, visitedOn: "2026-10-18", memo: "都庁" }),
      visit({ id: 2, visitedOn: "2026-10-18", placeName: "新宿御苑" }),
      visit({ id: 1, visitedOn: "2026-10-01", memo: "歌舞伎町" }),
    ]);
    mockCount.mockResolvedValue([{ municipalityCode: "13104", visitCount: 4 }]);
    await openFromList("新宿区 訪問済み");

    const items = sheet().getAllByTestId("visit-history-item");
    expect(items).toHaveLength(4);
    const texts = items.map((item) =>
      within(item)
        .getAllByText(/./)
        .map((node) => node.props.children as string),
    );
    expect(texts).toEqual([
      ["2099年12月31日（木）", "新宿区", "未来の予定"],
      ["2026年10月18日（日）", "新宿区", "都庁"],
      ["2026年10月18日（日）", "新宿御苑"],
      ["2026年10月1日（木）", "新宿区", "歌舞伎町"],
    ]);
    // メモの無い訪問に、空の行や「null」を出さない
    expect(sheet().queryByText(/null/)).toBeNull();
    expect(within(items[2]).queryByText("")).toBeNull();
  });

  it("履歴が空なら、記録が無いことを日本語で出す", async () => {
    await openFromList("千代田区 未訪問");

    expect(sheet().getByText("まだ訪問の記録はありません")).toBeTruthy();
    expect(sheet().queryAllByTestId("visit-history-item")).toHaveLength(0);
    expect(sheet().queryByRole("alert")).toBeNull();
  });

  it("読み込みが終わるまでは、記録が無いとは表示しない", async () => {
    mockList.mockReturnValue(new Promise(() => {}));
    await openFromList("千代田区 未訪問");

    expect(sheet().getByRole("heading")).toHaveTextContent("千代田区");
    expect(sheet().queryByText("まだ訪問の記録はありません")).toBeNull();
  });

  it("シートには編集・削除の操作を置かない（ボタンは「追記」だけ）", async () => {
    mockList.mockResolvedValue([visit({ memo: "都庁" })]);
    await openFromList("新宿区 未訪問");

    expect(
      sheet()
        .queryAllByRole("button")
        .map((node) => within(node).getByText(/./).props.children as string),
    ).toEqual(["追記"]);
    expect(sheet().queryByText(/編集|削除/)).toBeNull();

    // 追記フォームを開いても、編集・削除の操作は出ない
    fireEvent.press(sheet().getByRole("button", { name: "追記" }));
    expect(sheet().queryByText(/編集|削除/)).toBeNull();
    expect(
      within(sheet().getByTestId("visit-history")).queryAllByRole("button"),
    ).toHaveLength(0);
  });
});

describe("読み込みの失敗と不正なコード", () => {
  it("履歴の取得に失敗したら、日本語のエラーを alert で出す（見出しは出したまま）", async () => {
    mockList.mockRejectedValue(new Error("disk I/O error"));
    await openFromList("新宿区 未訪問");

    expect(sheet().getByRole("alert")).toHaveTextContent(
      /訪問記録を読み込めませんでした/,
    );
    expect(sheet().getByRole("heading")).toHaveTextContent("新宿区");
    expect(sheet().queryByText("まだ訪問の記録はありません")).toBeNull();
  });

  it.each(["13301", "99999", "abc"])(
    "マスタにないコード %p では「見つからない」を出し、履歴は読まない",
    async (code) => {
      renderRouter("./app", { initialUrl: `/municipality/${code}` });
      expect(await screen.findByTestId("municipality-sheet")).toBeTruthy();
      await act(async () => {});

      expect(sheet().getByText(/区市が見つかりません/)).toBeTruthy();
      expect(sheet().queryByRole("heading")).toBeNull();
      expect(sheet().queryByRole("button", { name: "追記" })).toBeNull();
      expect(mockList).not.toHaveBeenCalled();
    },
  );
});

describe("シートを閉じる", () => {
  it("戻ると一覧に戻り、チェックと制覇数は変わらない", async () => {
    mockCount.mockResolvedValue([{ municipalityCode: "13104", visitCount: 1 }]);
    mockList.mockResolvedValue([visit({})]);
    const { getPathname } = renderRouter("./app", { initialUrl: "/list" });
    expect(await screen.findByText("1 / 49")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "新宿区 訪問済み" }));
    expect(await screen.findByTestId("municipality-sheet")).toBeTruthy();
    await act(async () => {});

    act(() => router.back());
    await act(async () => {});

    expect(getPathname()).toBe("/list");
    expect(screen.queryByTestId("municipality-sheet")).toBeNull();
    expect(screen.getByTestId("list-screen")).toBeTruthy();
    expect(screen.getByText("1 / 49")).toBeTruthy();
    expect(screen.getByLabelText("新宿区 訪問済み")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(1);
  });
});

describe("追記", () => {
  // 時計は JST 2026-10-18 0:30（UTC では前日の 15:30）に固定する。
  const NOW = new Date(2026, 9, 18, 0, 30);

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const addButton = () => sheet().getByRole("button", { name: "追記" });
  const saveButton = () => sheet().getByRole("button", { name: "保存" });
  const form = () => within(screen.getByTestId("add-visit-form"));

  async function openForm(label: string) {
    const result = await openFromList(label);
    fireEvent.press(addButton());
    expect(screen.getByTestId("add-visit-form")).toBeTruthy();
    return result;
  }

  it.each([
    ["訪問済み", "新宿区 訪問済み", [visit({})]],
    ["未訪問", "新宿区 未訪問", []],
  ])("%sの区市のシートに「追記」がある", async (_label, rowLabel, rows) => {
    mockList.mockResolvedValue(rows);
    mockCount.mockResolvedValue(
      rows.length > 0 ? [{ municipalityCode: "13104", visitCount: 1 }] : [],
    );
    await openFromList(rowLabel);
    expect(addButton()).toBeTruthy();
    expect(screen.queryByTestId("add-visit-form")).toBeNull();
  });

  it("押すとシート内に場所名・訪問日・メモ・保存・キャンセルが出て、区市の選択欄は無い", async () => {
    const { getPathname } = await openForm("新宿区 未訪問");

    expect(getPathname()).toBe("/municipality/13104");
    expect(form().getByLabelText("場所名")).toBeTruthy();
    expect(form().getByRole("button", { name: "訪問日を変更" })).toBeTruthy();
    expect(form().getByLabelText("メモ")).toBeTruthy();
    expect(form().getByRole("button", { name: "保存" })).toBeTruthy();
    expect(form().getByRole("button", { name: "キャンセル" })).toBeTruthy();
    expect(sheet().queryAllByRole("radio")).toHaveLength(0);
    expect(sheet().queryByRole("button", { name: "追記" })).toBeNull();
  });

  it("訪問日の初期値は端末のローカル日付の今日（UTC では前日になる時刻でも）", async () => {
    await openForm("新宿区 未訪問");
    expect(form().getByText("2026年10月18日（日）")).toBeTruthy();
  });

  it("ピッカーで過去日・未来日を選べ、キャンセルでは日付が変わらない", async () => {
    await openForm("新宿区 未訪問");
    const dateButton = () =>
      form().getByRole("button", { name: "訪問日を変更" });

    fireEvent.press(dateButton());
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
    expect(form().getByText("2020年2月29日（土）")).toBeTruthy();

    fireEvent.press(dateButton());
    act(() => {
      mockOpenPicker.mock.calls[1][0].onChange?.(
        { type: "set", nativeEvent: { timestamp: 0, utcOffset: 540 } },
        new Date(2030, 0, 1),
      );
    });
    expect(form().getByText("2030年1月1日（火）")).toBeTruthy();

    fireEvent.press(dateButton());
    act(() => {
      mockOpenPicker.mock.calls[2][0].onChange?.(
        { type: "dismissed", nativeEvent: { timestamp: 0, utcOffset: 540 } },
        undefined,
      );
    });
    expect(form().getByText("2030年1月1日（火）")).toBeTruthy();
  });

  it.each([
    ["空", "", "新宿区"],
    ["空白だけ", "  　\t", "新宿区"],
    ["前後に空白がある", "  新宿御苑 ", "新宿御苑"],
  ])(
    "場所名が%sなら %p を place_name にして、確認なしで1回保存する",
    async (_label, input, expected) => {
      await openForm("新宿区 未訪問");
      fireEvent.changeText(form().getByLabelText("場所名"), input);
      fireEvent.changeText(form().getByLabelText("メモ"), "都庁");

      fireEvent.press(saveButton());
      await act(async () => {});

      expect(mockAddVisit).toHaveBeenCalledTimes(1);
      expect(mockAddVisit).toHaveBeenCalledWith(expect.anything(), {
        municipalityCode: "13104",
        visitedOn: "2026-10-18",
        memo: "都庁",
        source: "manual",
        placeName: expected,
      });
    },
  );

  it("保存すると履歴を読み直して新しい行を並び順どおりに出し、フォームは閉じてシートは開いたまま", async () => {
    const older = visit({ id: 1, visitedOn: "2026-10-18", placeName: "都庁" });
    const added = visit({
      id: 2,
      visitedOn: "2026-10-18",
      placeName: "新宿御苑",
    });
    mockList.mockResolvedValueOnce([older]).mockResolvedValue([added, older]);
    mockCount.mockResolvedValue([{ municipalityCode: "13104", visitCount: 1 }]);
    const { getPathname } = await openForm("新宿区 訪問済み");
    expect(mockList).toHaveBeenCalledTimes(1);

    fireEvent.changeText(form().getByLabelText("場所名"), "新宿御苑");
    fireEvent.press(saveButton());
    await act(async () => {});

    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockList).toHaveBeenLastCalledWith(expect.anything(), "13104");
    const places = sheet()
      .getAllByTestId("visit-history-item")
      .map((item) => within(item).getAllByText(/./)[1].props.children);
    expect(places).toEqual(["新宿御苑", "都庁"]);
    expect(screen.queryByTestId("add-visit-form")).toBeNull();
    expect(getPathname()).toBe("/municipality/13104");

    // もう一度開くと、入力はリセットされている
    fireEvent.press(addButton());
    expect(form().getByLabelText("場所名").props.value).toBe("");
    expect(form().getByLabelText("メモ").props.value).toBe("");
    expect(form().getByText("2026年10月18日（日）")).toBeTruthy();
  });

  it("未訪問の区市で保存すると「まだ訪問の記録はありません」が消えて履歴が出る", async () => {
    mockList.mockResolvedValueOnce([]).mockResolvedValue([visit({})]);
    await openForm("新宿区 未訪問");
    expect(sheet().getByText("まだ訪問の記録はありません")).toBeTruthy();

    fireEvent.press(saveButton());
    await act(async () => {});

    expect(sheet().queryByText("まだ訪問の記録はありません")).toBeNull();
    expect(sheet().getAllByTestId("visit-history-item")).toHaveLength(1);
  });

  it("シートで保存して閉じると、一覧の行が訪問済みになり制覇数が1増える", async () => {
    mockCount
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ municipalityCode: "13104", visitCount: 1 }]);
    const { getPathname } = renderRouter("./app", { initialUrl: "/list" });
    expect(await screen.findByText("0 / 49")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "新宿区 未訪問" }));
    expect(await screen.findByTestId("municipality-sheet")).toBeTruthy();
    await act(async () => {});
    const countCalls = mockCount.mock.calls.length;

    fireEvent.press(addButton());
    fireEvent.press(saveButton());
    await act(async () => {});

    act(() => router.back());
    await act(async () => {});

    expect(getPathname()).toBe("/list");
    expect(mockCount.mock.calls.length).toBeGreaterThan(countCalls);
    expect(screen.getByText("1 / 49")).toBeTruthy();
    expect(screen.getByLabelText("新宿区 訪問済み")).toBeTruthy();
  });

  it("保存の処理中に連打しても addVisit は1回だけ", async () => {
    let finish: (id: number) => void = () => {};
    mockAddVisit.mockImplementation(
      () => new Promise<number>((resolve) => (finish = resolve)),
    );
    await openForm("新宿区 未訪問");

    fireEvent.press(saveButton());
    fireEvent.press(saveButton());
    fireEvent.press(saveButton());
    expect(mockAddVisit).toHaveBeenCalledTimes(1);

    await act(async () => finish(1));
    expect(mockAddVisit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("add-visit-form")).toBeNull();
  });

  it("保存に失敗すると日本語のエラーを alert で出し、入力を残してもう一度保存できる", async () => {
    mockAddVisit.mockRejectedValueOnce(new Error("disk full"));
    await openForm("新宿区 未訪問");
    fireEvent.changeText(form().getByLabelText("場所名"), "新宿御苑");
    fireEvent.changeText(form().getByLabelText("メモ"), "庭園");

    fireEvent.press(saveButton());
    await act(async () => {});

    expect(form().getByRole("alert")).toHaveTextContent(
      "保存できませんでした。もう一度お試しください。",
    );
    expect(form().getByLabelText("場所名").props.value).toBe("新宿御苑");
    expect(form().getByLabelText("メモ").props.value).toBe("庭園");
    expect(saveButton()).toBeEnabled();
    expect(mockList).toHaveBeenCalledTimes(1);

    fireEvent.press(saveButton());
    await act(async () => {});
    expect(mockAddVisit).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("add-visit-form")).toBeNull();
  });

  it("キャンセルを押すと何も保存せずにフォームが閉じる", async () => {
    await openForm("新宿区 未訪問");
    fireEvent.changeText(form().getByLabelText("場所名"), "新宿御苑");

    fireEvent.press(form().getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByTestId("add-visit-form")).toBeNull();
    expect(addButton()).toBeTruthy();
    expect(mockAddVisit).not.toHaveBeenCalled();
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});
