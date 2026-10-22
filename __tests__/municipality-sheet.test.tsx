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
  countVisitsByMunicipality,
  listVisitsByMunicipality,
  type Visit,
} from "../src/db/visits";

jest.mock("../src/db/visits", () => ({
  countVisitsByMunicipality: jest.fn(),
  listVisitsByMunicipality: jest.fn(),
}));

const mockCount = jest.mocked(countVisitsByMunicipality);
const mockList = jest.mocked(listVisitsByMunicipality);

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

  it("シートには追記・編集・削除の操作を置かない（ボタンが無い）", async () => {
    mockList.mockResolvedValue([visit({ memo: "都庁" })]);
    await openFromList("新宿区 未訪問");

    expect(sheet().queryAllByRole("button")).toHaveLength(0);
    expect(sheet().queryByText(/追加|追記|編集|削除/)).toBeNull();
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
