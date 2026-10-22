import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { ConquestCount } from "../src/components/ConquestCount";
import { MUNICIPALITIES } from "../src/data/municipalities";
import { countVisitsByMunicipality } from "../src/db/visits";

jest.mock("../src/db/visits", () => ({
  countVisitsByMunicipality: jest.fn(),
}));

const mockCount = jest.mocked(countVisitsByMunicipality);

beforeEach(() => {
  mockCount.mockReset();
  mockCount.mockResolvedValue([]);
});

// 一覧タブを開き、集計の読み込みが終わって画面に反映されるまで待つ。
// 結果が「空」のように表示が変わらないテストでも、更新が act の外に漏れないようにする。
async function renderList() {
  renderRouter("./app", { initialUrl: "/list" });
  await screen.findByTestId("list-screen");
  await act(async () => {});
}

// 地図タブへ移ってから一覧に戻る（一覧にフォーカスが戻る）。
async function leaveAndReturnToList() {
  fireEvent.press(screen.getByText("地図"));
  expect(await screen.findByTestId("map-screen")).toBeTruthy();
  fireEvent.press(screen.getByText("一覧"));
  // 読み直しの結果が反映されるまで、act の中で待つ
  await act(async () => {});
}

describe("一覧タブ", () => {
  it("制覇数「0 / 49」が出る", async () => {
    await renderList();

    expect(await screen.findByText("0 / 49")).toBeTruthy();
    // 分母はマスタの件数から求めた値
    expect(screen.getByText(`0 / ${MUNICIPALITIES.length}`)).toBeTruthy();
  });

  it("49区市の名称が JIS コード順にすべて描画され、先頭は千代田区・末尾は西東京市", async () => {
    await renderList();

    const expected = MUNICIPALITIES.map((m) => m.name);
    expect(expected).toHaveLength(49);
    expect(expected[0]).toBe("千代田区");
    expect(expected[48]).toBe("西東京市");

    // 制覇数やタブ名ではなく、区市名の行だけを表示順に取り出す
    const rendered = screen
      .getAllByText(/[区市]$/)
      .map((node) => node.props.children as string);
    expect(rendered).toEqual(expected);
  });
});

describe("訪問済みの表示", () => {
  it("訪問のない間は、どの行にも印が付かず、全行が未訪問と読み上げられる", async () => {
    await renderList();

    expect(screen.getByText("0 / 49")).toBeTruthy();
    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByText("✓")).toHaveLength(0);
    expect(screen.getAllByLabelText(/ 未訪問$/)).toHaveLength(49);
    expect(screen.queryAllByLabelText(/ 訪問済み$/)).toHaveLength(0);
  });

  it("訪問のある区市の行にだけ印が付き、制覇数にその数が出る（区市名と印は別の要素）", async () => {
    mockCount.mockResolvedValue([
      { municipalityCode: "13101", visitCount: 1 },
      { municipalityCode: "13229", visitCount: 3 },
    ]);
    renderRouter("./app", { initialUrl: "/list" });

    expect(await screen.findByText("2 / 49")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(2);

    const chiyoda = screen.getByLabelText("千代田区 訪問済み");
    expect(within(chiyoda).getByText("千代田区")).toBeTruthy();
    expect(within(chiyoda).getByText("✓")).toBeTruthy();
    expect(
      within(screen.getByLabelText("西東京市 訪問済み")).getByText("✓"),
    ).toBeTruthy();

    const shinjuku = screen.getByLabelText("新宿区 未訪問");
    expect(within(shinjuku).getByText("新宿区")).toBeTruthy();
    expect(within(shinjuku).queryByText("✓")).toBeNull();
    expect(screen.getAllByLabelText(/ 未訪問$/)).toHaveLength(47);
  });

  it("訪問回数が多くても、同じ区市は1と数え、回数は表示しない", async () => {
    mockCount.mockResolvedValue([
      { municipalityCode: "13104", visitCount: 12 },
    ]);
    renderRouter("./app", { initialUrl: "/list" });

    expect(await screen.findByText("1 / 49")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(1);
    expect(screen.queryByText(/12/)).toBeNull();
  });

  it("区市マスタにないコードは、チェックにも制覇数にも含めない", async () => {
    mockCount.mockResolvedValue([
      { municipalityCode: "13301", visitCount: 2 },
      { municipalityCode: "13101", visitCount: 1 },
    ]);
    renderRouter("./app", { initialUrl: "/list" });

    expect(await screen.findByText("1 / 49")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(1);
    expect(screen.getAllByLabelText(/ 訪問済み$/)).toHaveLength(1);
  });

  it("別のタブから一覧に戻るたびに読み直す。全削除された区市は未訪問に戻り、制覇数が1減る", async () => {
    mockCount
      .mockResolvedValueOnce([
        { municipalityCode: "13101", visitCount: 1 },
        { municipalityCode: "13102", visitCount: 1 },
      ])
      // 千代田区の訪問がすべて消えた後の集計
      .mockResolvedValueOnce([{ municipalityCode: "13102", visitCount: 1 }]);
    renderRouter("./app", { initialUrl: "/list" });
    expect(await screen.findByText("2 / 49")).toBeTruthy();
    expect(screen.getByLabelText("千代田区 訪問済み")).toBeTruthy();

    await leaveAndReturnToList();

    expect(await screen.findByText("1 / 49")).toBeTruthy();
    expect(mockCount).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("千代田区 未訪問")).toBeTruthy();
    expect(screen.getByLabelText("中央区 訪問済み")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(1);
  });

  it("読み直している間は、前回の表示を残す", async () => {
    mockCount
      .mockResolvedValueOnce([{ municipalityCode: "13101", visitCount: 1 }])
      .mockReturnValueOnce(new Promise(() => {}));
    renderRouter("./app", { initialUrl: "/list" });
    expect(await screen.findByText("1 / 49")).toBeTruthy();

    await leaveAndReturnToList();

    expect(await screen.findByTestId("list-screen")).toBeTruthy();
    expect(mockCount).toHaveBeenCalledTimes(2);
    expect(screen.getByText("1 / 49")).toBeTruthy();
    expect(screen.getByLabelText("千代田区 訪問済み")).toBeTruthy();
  });
});

describe("読み込みの失敗", () => {
  it("集計に失敗したら日本語のエラーを alert で出し、一覧は表示したまま", async () => {
    mockCount.mockRejectedValue(new Error("disk I/O error"));
    renderRouter("./app", { initialUrl: "/list" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/訪問記録を読み込めませんでした/);
    expect(screen.getByText("0 / 49")).toBeTruthy();
    expect(screen.getAllByLabelText(/ 未訪問$/)).toHaveLength(49);
  });

  it("失敗のあと、戻って読み込めればエラーは消える", async () => {
    mockCount
      .mockRejectedValueOnce(new Error("locked"))
      .mockResolvedValueOnce([{ municipalityCode: "13101", visitCount: 1 }]);
    renderRouter("./app", { initialUrl: "/list" });
    expect(await screen.findByRole("alert")).toBeTruthy();

    await leaveAndReturnToList();

    expect(await screen.findByText("1 / 49")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("ConquestCount", () => {
  it("渡された数値を「訪問済み / 全体」の形で表示する", () => {
    render(<ConquestCount visited={3} total={49} />);
    expect(screen.getByText("3 / 49")).toBeTruthy();
  });
});
