import {
  act,
  fireEvent,
  renderRouter,
  screen,
  within,
} from "expo-router/testing-library";
import { Alert, type AlertButton } from "react-native";

import {
  countVisitsByMunicipality,
  importVisits,
  listVisits,
  type Visit,
} from "../src/db/visits";
import { pickTextFile, shareTextFile } from "../src/lib/transfer-io";

jest.mock("../src/db/visits", () => ({
  countVisitsByMunicipality: jest.fn(),
  importVisits: jest.fn(),
  listVisits: jest.fn(),
}));

// ファイルの共有と選択は端末の機能なので差し替える。
jest.mock("../src/lib/transfer-io", () => ({
  pickTextFile: jest.fn(),
  shareTextFile: jest.fn(),
}));

const mockCount = jest.mocked(countVisitsByMunicipality);
const mockImport = jest.mocked(importVisits);
const mockListVisits = jest.mocked(listVisits);
const mockPick = jest.mocked(pickTextFile);
const mockShare = jest.mocked(shareTextFile);
const alert = jest.spyOn(Alert, "alert");

const visit = (overrides: Partial<Visit>): Visit => ({
  id: 1,
  placeName: "西新宿",
  municipalityCode: "13104",
  source: "town",
  refId: 123,
  visitedOn: "2026-10-12",
  memo: null,
  createdAt: "2026-10-12T08:00:00.000Z",
  updatedAt: "2026-10-12T08:00:00.000Z",
  ...overrides,
});

const VALID_FILE = JSON.stringify({
  version: 1,
  exportedAt: "2026-10-12T08:00:00Z",
  visits: [
    {
      placeName: "西新宿",
      municipalityCode: "13104",
      source: "town",
      refId: 123,
      visitedOn: "2026-10-12",
      memo: null,
      createdAt: "2026-10-12T08:00:00Z",
      updatedAt: "2026-10-12T08:00:00Z",
    },
    {
      placeName: "東京ドーム",
      municipalityCode: "13105",
      source: "manual",
      visitedOn: "2026-10-13",
      memo: "野球",
    },
  ],
});

// 時計は JST 2026-11-15 に固定する。
const NOW = new Date(2026, 10, 15, 9, 0);

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockCount.mockReset();
  mockCount.mockResolvedValue([]);
  mockImport.mockReset();
  mockImport.mockResolvedValue({ added: 2, skipped: 0 });
  mockListVisits.mockReset();
  mockListVisits.mockResolvedValue([]);
  mockPick.mockReset();
  mockPick.mockResolvedValue(null);
  mockShare.mockReset();
  mockShare.mockResolvedValue();
  alert.mockReset();
  alert.mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
});

const settings = () => within(screen.getByTestId("settings-screen"));
const notice = () => screen.getByTestId("settings-notice");

async function openSettings() {
  const result = renderRouter("./app", { initialUrl: "/settings" });
  expect(await screen.findByTestId("settings-screen")).toBeTruthy();
  await act(async () => {});
  return result;
}

async function press(name: string) {
  fireEvent.press(settings().getByRole("button", { name }));
  await act(async () => {});
}

/** 確認ダイアログのボタンを押す。 */
async function pressAlertButton(text: string) {
  const buttons = alert.mock.calls[alert.mock.calls.length - 1][2] as AlertButton[];
  const button = buttons.find((b) => b.text === text);
  if (!button) throw new Error(`ダイアログに無いボタン: ${text}`);
  await act(async () => button.onPress?.());
}

describe("設定画面への隠し導線", () => {
  it.each([
    ["地図タブ", "/", "map-screen"],
    ["一覧タブ", "/list", "list-screen"],
  ])(
    "%sには設定へのボタンが無く、制覇数を長押しすると設定画面が開く",
    async (_tab, initialUrl, testID) => {
      const { getPathname } = renderRouter("./app", { initialUrl });
      const tab = within(await screen.findByTestId(testID));
      await act(async () => {});

      expect(screen.queryByText(/設定/)).toBeNull();
      expect(screen.queryByLabelText(/設定/)).toBeNull();

      fireEvent(tab.getByRole("heading"), "longPress");

      expect(await screen.findByTestId("settings-screen")).toBeTruthy();
      expect(getPathname()).toBe("/settings");
    },
  );

  it("制覇数を普通に押しただけでは開かない", async () => {
    const { getPathname } = renderRouter("./app", { initialUrl: "/list" });
    const tab = within(await screen.findByTestId("list-screen"));
    await act(async () => {});

    fireEvent.press(tab.getByRole("heading"));
    await act(async () => {});

    expect(getPathname()).toBe("/list");
    expect(screen.queryByTestId("settings-screen")).toBeNull();
  });

  it("設定画面にあるのはエクスポートとインポートだけ", async () => {
    await openSettings();

    expect(
      settings()
        .getAllByRole("button")
        .map((node) => within(node).getByText(/./).props.children as string),
    ).toEqual(["エクスポート", "インポート"]);
  });
});

describe("エクスポート", () => {
  it("全訪問を要件書の形式の JSON にして、共有シートへ渡す", async () => {
    mockListVisits.mockResolvedValue([
      visit({ id: 2, placeName: "上野駅", source: "station", refId: 30 }),
      visit({ id: 1, memo: "都庁" }),
    ]);
    await openSettings();

    await press("エクスポート");

    expect(mockListVisits).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledTimes(1);
    const [fileName, content] = mockShare.mock.calls[0];
    // ファイル名は端末のローカル日付
    expect(fileName).toBe("tokyo-49-export-20261115.json");
    expect(JSON.parse(content)).toEqual({
      version: 1,
      exportedAt: NOW.toISOString(),
      visits: [
        {
          placeName: "上野駅",
          municipalityCode: "13104",
          source: "station",
          refId: 30,
          visitedOn: "2026-10-12",
          memo: null,
          createdAt: "2026-10-12T08:00:00.000Z",
          updatedAt: "2026-10-12T08:00:00.000Z",
        },
        {
          placeName: "西新宿",
          municipalityCode: "13104",
          source: "town",
          refId: 123,
          visitedOn: "2026-10-12",
          memo: "都庁",
          createdAt: "2026-10-12T08:00:00.000Z",
          updatedAt: "2026-10-12T08:00:00.000Z",
        },
      ],
    });
    expect(notice()).toHaveTextContent("2件の訪問を書き出しました。");
    // DB は読むだけ
    expect(mockImport).not.toHaveBeenCalled();
  });

  it("訪問が0件でも、visits が空のファイルを書き出せる", async () => {
    await openSettings();
    await press("エクスポート");

    expect(JSON.parse(mockShare.mock.calls[0][1]).visits).toEqual([]);
    expect(notice()).toHaveTextContent("0件の訪問を書き出しました。");
  });

  it("失敗したら日本語のエラーを alert で出し、もう一度押せる", async () => {
    mockShare.mockRejectedValueOnce(new Error("no share target"));
    await openSettings();

    await press("エクスポート");
    expect(settings().getByRole("alert")).toHaveTextContent(
      "エクスポートできませんでした。もう一度お試しください。",
    );

    await press("エクスポート");
    expect(mockShare).toHaveBeenCalledTimes(2);
    expect(settings().queryByRole("alert")).toBeNull();
  });

  it("処理中に連打しても1回だけ", async () => {
    let finish: () => void = () => {};
    mockShare.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    await openSettings();

    await press("エクスポート");
    fireEvent.press(settings().getByRole("button", { name: "エクスポート" }));
    fireEvent.press(settings().getByRole("button", { name: "インポート" }));
    await act(async () => {});
    expect(mockListVisits).toHaveBeenCalledTimes(1);
    expect(mockPick).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(mockShare).toHaveBeenCalledTimes(1);
  });
});

describe("インポート", () => {
  it("ファイルを選ばずに閉じたら、何もしない", async () => {
    await openSettings();

    await press("インポート");

    expect(mockPick).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    expect(mockImport).not.toHaveBeenCalled();
    expect(screen.queryByTestId("settings-notice")).toBeNull();
  });

  it.each([
    ["JSON でない", "こんにちは", "JSON として読み取れません"],
    [
      "version が違う",
      JSON.stringify({ version: 2, visits: [] }),
      "version が 1 ではありません",
    ],
    [
      "2件目の区市コードが不正",
      JSON.stringify({
        version: 1,
        visits: [
          JSON.parse(VALID_FILE).visits[0],
          { ...JSON.parse(VALID_FILE).visits[1], municipalityCode: "13301" },
        ],
      }),
      "visits[1].municipalityCode が49区市のコードではありません（13301）",
    ],
  ])(
    "不正なファイル（%s）は理由つきで拒否し、確認も出さず DB にも触れない",
    async (_label, text, reason) => {
      mockPick.mockResolvedValue(text);
      await openSettings();

      await press("インポート");

      expect(settings().getByRole("alert")).toHaveTextContent(
        `このファイルはインポートできません。${reason}`,
      );
      expect(alert).not.toHaveBeenCalled();
      expect(mockImport).not.toHaveBeenCalled();
    },
  );

  it("正しいファイルなら、取り込む前にマージか上書きかを確認する（上書きは破壊的と明示）", async () => {
    mockPick.mockResolvedValue(VALID_FILE);
    await openSettings();

    await press("インポート");

    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe("インポート");
    expect(message).toMatch(/2件の訪問/);
    expect(message).toMatch(/すべて削除/);
    expect(message).toMatch(/元に戻せません/);
    expect(buttons).toEqual([
      expect.objectContaining({ text: "キャンセル", style: "cancel" }),
      expect.objectContaining({ text: "マージ（追加のみ）" }),
      expect.objectContaining({
        text: "上書き（すべて削除）",
        style: "destructive",
      }),
    ]);
    // 選ぶまでは取り込まない
    expect(mockImport).not.toHaveBeenCalled();
  });

  it("キャンセルを選んだら、何も取り込まない", async () => {
    mockPick.mockResolvedValue(VALID_FILE);
    await openSettings();
    await press("インポート");

    await pressAlertButton("キャンセル");

    expect(mockImport).not.toHaveBeenCalled();
    expect(screen.queryByTestId("settings-notice")).toBeNull();
  });

  it("マージを選ぶと、検証済みの訪問を merge で取り込み、追加とスキップの件数を出す", async () => {
    mockPick.mockResolvedValue(VALID_FILE);
    mockImport.mockResolvedValue({ added: 1, skipped: 1 });
    await openSettings();
    await press("インポート");

    await pressAlertButton("マージ（追加のみ）");

    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockImport).toHaveBeenCalledWith(
      expect.anything(),
      [
        {
          placeName: "西新宿",
          municipalityCode: "13104",
          source: "town",
          refId: 123,
          visitedOn: "2026-10-12",
          memo: null,
          createdAt: "2026-10-12T08:00:00Z",
          updatedAt: "2026-10-12T08:00:00Z",
        },
        {
          placeName: "東京ドーム",
          municipalityCode: "13105",
          source: "manual",
          refId: null,
          visitedOn: "2026-10-13",
          memo: "野球",
          createdAt: null,
          updatedAt: null,
        },
      ],
      "merge",
    );
    expect(notice()).toHaveTextContent("取り込みました。追加1件・スキップ1件");
  });

  it("上書きを選ぶと、overwrite で取り込む", async () => {
    mockPick.mockResolvedValue(VALID_FILE);
    await openSettings();
    await press("インポート");

    await pressAlertButton("上書き（すべて削除）");

    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockImport.mock.calls[0][2]).toBe("overwrite");
    expect(mockImport.mock.calls[0][1]).toHaveLength(2);
    expect(notice()).toHaveTextContent("上書きしました。追加2件");
  });

  it("取り込みに失敗したら、履歴は変えていないことを alert で伝える", async () => {
    mockPick.mockResolvedValue(VALID_FILE);
    mockImport.mockRejectedValue(new Error("disk full"));
    await openSettings();
    await press("インポート");

    await pressAlertButton("上書き（すべて削除）");

    expect(settings().getByRole("alert")).toHaveTextContent(
      "インポートできませんでした。訪問履歴は変更していません。",
    );
  });

  it("ファイルを読めなかったら、日本語のエラーを alert で出す", async () => {
    mockPick.mockRejectedValue(new Error("permission denied"));
    await openSettings();

    await press("インポート");

    expect(settings().getByRole("alert")).toHaveTextContent(
      "ファイルを読み込めませんでした。もう一度お試しください。",
    );
    expect(mockImport).not.toHaveBeenCalled();
  });

  it("取り込んでホームに戻ると、一覧に反映されている", async () => {
    mockPick.mockResolvedValue(VALID_FILE);
    const { getPathname } = renderRouter("./app", { initialUrl: "/list" });
    const tab = within(await screen.findByTestId("list-screen"));
    await act(async () => {});
    fireEvent(tab.getByRole("heading"), "longPress");
    expect(await screen.findByTestId("settings-screen")).toBeTruthy();

    await press("インポート");
    mockCount.mockResolvedValue([
      { municipalityCode: "13104", visitCount: 1 },
      { municipalityCode: "13105", visitCount: 1 },
    ]);
    await pressAlertButton("マージ（追加のみ）");

    const { router } = jest.requireActual<typeof import("expo-router")>(
      "expo-router",
    );
    act(() => router.back());
    expect(await screen.findByText("2 / 49")).toBeTruthy();
    expect(getPathname()).toBe("/list");
    expect(screen.getByLabelText("文京区 訪問済み")).toBeTruthy();
  });
});
