import {
  act,
  fireEvent,
  renderRouter,
  screen,
  within,
} from "expo-router/testing-library";

import { openDictDb } from "../src/db/dict-db";
import {
  searchCandidates,
  type Candidate,
  type SearchResult,
} from "../src/db/dict-search";
import { addVisit, countVisitsByMunicipality } from "../src/db/visits";

jest.mock("../src/db/visits", () => ({
  addVisit: jest.fn(),
  countVisitsByMunicipality: jest.fn(),
}));

jest.mock("../src/db/dict-db", () => ({
  openDictDb: jest.fn(),
}));

// 検索の SQL は dict-search のテストで確かめる。ここでは画面の振る舞いだけを見る。
jest.mock("../src/db/dict-search", () => ({
  ...jest.requireActual("../src/db/dict-search"),
  searchCandidates: jest.fn(),
}));

jest.mock("@react-native-community/datetimepicker", () => ({
  DateTimePickerAndroid: { open: jest.fn() },
}));

const mockAddVisit = jest.mocked(addVisit);
const mockCount = jest.mocked(countVisitsByMunicipality);
const mockOpenDict = jest.mocked(openDictDb);
const mockSearch = jest.mocked(searchCandidates);

const DICT = { name: "dict" } as unknown as Awaited<
  ReturnType<typeof openDictDb>
>;

const station = (
  id: number,
  name: string,
  municipalityCode: string,
  municipalityName: string,
): Candidate => ({
  source: "station",
  id,
  name,
  municipalityCode,
  municipalityName,
});
const town = (
  id: number,
  name: string,
  municipalityCode: string,
  municipalityName: string,
): Candidate => ({ source: "town", id, name, municipalityCode, municipalityName });

const UENO = station(30, "上野", "13106", "台東区");
const UENO_HIROKOJI = station(31, "上野広小路", "13106", "台東区");
const UENO_TOWN = town(200, "上野", "13106", "台東区");
const NISHI_SHINJUKU = town(940, "西新宿", "13104", "新宿区");

const results: Record<string, SearchResult> = {
  上野: { candidates: [UENO, UENO_HIROKOJI, UENO_TOWN], total: 3 },
  上野駅: { candidates: [UENO, UENO_HIROKOJI, UENO_TOWN], total: 3 },
  西新宿: { candidates: [NISHI_SHINJUKU], total: 1 },
  本町: {
    candidates: [
      town(1, "本町", "13113", "渋谷区"),
      town(2, "本町", "13114", "中野区"),
    ],
    total: 2,
  },
};
const NONE: SearchResult = { candidates: [], total: 0 };

// 時計は JST 2026-10-18 に固定する。
const NOW = new Date(2026, 9, 18, 12, 0);

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockAddVisit.mockReset();
  mockAddVisit.mockResolvedValue(1);
  mockCount.mockReset();
  mockCount.mockResolvedValue([]);
  mockOpenDict.mockReset();
  mockOpenDict.mockResolvedValue(DICT);
  mockSearch.mockReset();
  mockSearch.mockImplementation(async (_db, input) => results[input] ?? NONE);
});

afterEach(() => {
  jest.useRealTimers();
});

const input = () => screen.getByLabelText("場所");
const saveButton = () => screen.getByRole("button", { name: "保存" });
const selectedMunicipality = () => screen.getByTestId("selected-municipality");
const candidateList = () => within(screen.getByTestId("candidate-list"));
const candidateLabels = () =>
  candidateList()
    .queryAllByRole("button")
    .map((node) => within(node).getByText(/./).props.children as string);

async function openScreen() {
  const result = renderRouter("./app", { initialUrl: "/" });
  fireEvent.press(await screen.findByRole("button", { name: "訪問を記録" }));
  expect(await screen.findByTestId("visit-new-screen")).toBeTruthy();
  // 辞書の準備が終わるまで待つ
  await act(async () => {});
  return result;
}

async function type(text: string) {
  fireEvent.changeText(input(), text);
  await act(async () => {});
}

describe("候補の表示", () => {
  it("入力するまでは候補を出さず、検索もしない", async () => {
    await openScreen();

    expect(screen.queryByTestId("candidate-list")).toBeNull();
    expect(mockSearch).not.toHaveBeenCalled();
    expect(input().props.value).toBe("");
  });

  it("入力するたびに辞書を検索し、駅を先に「上野駅（台東区）」の形で候補を出す", async () => {
    await openScreen();

    await type("上野");

    expect(mockSearch).toHaveBeenLastCalledWith(DICT, "上野");
    expect(candidateLabels()).toEqual([
      "上野駅（台東区）",
      "上野広小路駅（台東区）",
      "上野（台東区）",
    ]);
  });

  it("「駅」付きの入力でも候補が出る", async () => {
    await openScreen();
    await type("上野駅");
    expect(candidateLabels()).toContain("上野駅（台東区）");
  });

  it("同名の町域は、区市名を併記した候補が区市ごとに並ぶ", async () => {
    await openScreen();
    await type("本町");
    expect(candidateLabels()).toEqual(["本町（渋谷区）", "本町（中野区）"]);
  });

  it("空白だけ・「駅」だけの入力では検索せず、候補も「候補なし」も出さない", async () => {
    await openScreen();
    for (const text of [" ", "　", "駅"]) {
      await type(text);
      expect(screen.queryByTestId("candidate-list")).toBeNull();
    }
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("入力を消すと候補も消える", async () => {
    await openScreen();
    await type("上野");
    expect(screen.getByTestId("candidate-list")).toBeTruthy();

    await type("");
    expect(screen.queryByTestId("candidate-list")).toBeNull();
  });

  it("入力が進んだ後に届いた古い検索結果は表示しない", async () => {
    let finishOld: (result: SearchResult) => void = () => {};
    mockSearch.mockImplementation((_db, text) =>
      text === "上"
        ? new Promise<SearchResult>((resolve) => (finishOld = resolve))
        : Promise.resolve(results[text] ?? NONE),
    );
    await openScreen();

    await type("上");
    await type("西新宿");
    expect(candidateLabels()).toEqual(["西新宿（新宿区）"]);

    // 「上」の結果が後から届いても、いまの入力の候補のまま
    await act(async () => finishOld(results["上野"]));
    expect(candidateLabels()).toEqual(["西新宿（新宿区）"]);
  });

  it("検索の結果が届くまでは「候補なし」と出さない", async () => {
    mockSearch.mockReturnValue(new Promise(() => {}));
    await openScreen();

    await type("上野");

    expect(screen.queryByText("候補なし")).toBeNull();
  });

  it("辞書が使えなくても画面は使え、区市の直接選択で記録できる", async () => {
    mockOpenDict.mockRejectedValue(new Error("no dict"));
    const { getPathname } = await openScreen();

    await type("上野");
    expect(mockSearch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("candidate-list")).toBeNull();

    fireEvent.press(screen.getByRole("radio", { name: "台東区" }));
    fireEvent.press(saveButton());
    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(getPathname()).toBe("/");
    expect(mockAddVisit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        placeName: "上野",
        municipalityCode: "13106",
        source: "manual",
      }),
    );
  });
});

describe("候補の上限と「他N件」", () => {
  const many = (total: number): SearchResult => ({
    candidates: Array.from({ length: Math.min(total, 30) }, (_, i) =>
      town(i + 1, `あ町${i + 1}`, "13104", "新宿区"),
    ),
    total,
  });

  it("30件を超えると、30件の末尾に「他N件」（N＝全ヒット件数−30）を出す", async () => {
    mockSearch.mockResolvedValue(many(45));
    await openScreen();

    await type("あ");

    expect(candidateLabels()).toHaveLength(30);
    expect(candidateList().getByText(/^他15件/)).toBeTruthy();
    // 候補の後ろ（末尾）にある
    const texts = candidateList()
      .getAllByText(/./)
      .map((node) => node.props.children as string);
    expect(texts[texts.length - 1]).toMatch(/^他15件/);
  });

  it("「他N件」はタップできない（表示のみ）", async () => {
    mockSearch.mockResolvedValue(many(31));
    await openScreen();
    await type("あ");

    expect(candidateList().getByText(/^他1件/)).toBeTruthy();
    expect(
      candidateList().queryByRole("button", { name: /^他1件/ }),
    ).toBeNull();
    expect(candidateList().getAllByRole("button")).toHaveLength(30);
  });

  it.each([[1], [29], [30]])("%d件なら「他N件」は出さない", async (total) => {
    mockSearch.mockResolvedValue(many(total));
    await openScreen();
    await type("あ");

    expect(candidateLabels()).toHaveLength(total);
    expect(candidateList().queryByText(/^他\d+件/)).toBeNull();
  });
});

describe("候補を選んで保存する", () => {
  it("駅を選ぶと区市が確定し、候補は閉じて、入力欄は「上野駅」になる", async () => {
    await openScreen();
    expect(saveButton()).toBeDisabled();
    await type("上野");

    fireEvent.press(
      candidateList().getByRole("button", { name: "上野駅（台東区）" }),
    );
    await act(async () => {});

    expect(selectedMunicipality()).toHaveTextContent("台東区");
    expect(screen.getByRole("radio", { name: "台東区" })).toBeSelected();
    expect(input().props.value).toBe("上野駅");
    expect(screen.queryByTestId("candidate-list")).toBeNull();
    expect(saveButton()).toBeEnabled();
  });

  it("駅を選んで保存すると、場所名「上野駅」・source=station・辞書の id で1回記録して戻る", async () => {
    const { getPathname } = await openScreen();
    await type("上野");
    fireEvent.press(
      candidateList().getByRole("button", { name: "上野駅（台東区）" }),
    );
    fireEvent.changeText(screen.getByLabelText("メモ"), "花見");

    fireEvent.press(saveButton());

    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(getPathname()).toBe("/");
    expect(mockAddVisit).toHaveBeenCalledTimes(1);
    expect(mockAddVisit).toHaveBeenCalledWith(expect.anything(), {
      municipalityCode: "13106",
      visitedOn: "2026-10-18",
      memo: "花見",
      source: "station",
      placeName: "上野駅",
      refId: 30,
    });
  });

  it("町域を選んで保存すると、場所名は町域名のみ（区市名は付けない）・source=town", async () => {
    await openScreen();
    await type("西新宿");
    fireEvent.press(
      candidateList().getByRole("button", { name: "西新宿（新宿区）" }),
    );
    expect(selectedMunicipality()).toHaveTextContent("新宿区");
    expect(input().props.value).toBe("西新宿");

    fireEvent.press(saveButton());

    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(mockAddVisit).toHaveBeenCalledWith(expect.anything(), {
      municipalityCode: "13104",
      visitedOn: "2026-10-18",
      memo: "",
      source: "town",
      placeName: "西新宿",
      refId: 940,
    });
  });

  it("同名の町域は、選んだ候補の区市で記録する", async () => {
    await openScreen();
    await type("本町");
    fireEvent.press(
      candidateList().getByRole("button", { name: "本町（中野区）" }),
    );
    fireEvent.press(saveButton());

    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(mockAddVisit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        placeName: "本町",
        municipalityCode: "13114",
        source: "town",
        refId: 2,
      }),
    );
  });

  it("選んだ後に入力を変えると確定が外れ、区市が決まるまで保存できない", async () => {
    await openScreen();
    await type("上野");
    fireEvent.press(
      candidateList().getByRole("button", { name: "上野駅（台東区）" }),
    );
    expect(saveButton()).toBeEnabled();

    await type("上野駅前");

    expect(selectedMunicipality()).toHaveTextContent(
      "下の一覧から選んでください",
    );
    expect(saveButton()).toBeDisabled();
    fireEvent.press(saveButton());
    expect(mockAddVisit).not.toHaveBeenCalled();
  });

  it("候補を選んだ後に区市を手で選び直すと、手動の入力として記録する", async () => {
    await openScreen();
    await type("上野");
    fireEvent.press(
      candidateList().getByRole("button", { name: "上野駅（台東区）" }),
    );

    fireEvent.press(screen.getByRole("radio", { name: "文京区" }));
    await act(async () => {});
    expect(selectedMunicipality()).toHaveTextContent("文京区");

    fireEvent.press(saveButton());
    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(mockAddVisit).toHaveBeenCalledWith(expect.anything(), {
      municipalityCode: "13105",
      visitedOn: "2026-10-18",
      memo: "",
      source: "manual",
      placeName: "上野駅",
    });
  });
});

describe("辞書にない入力（施設名・都外）", () => {
  it("「候補なし」と出し、区市の直接選択へ誘導する（都外かどうかは示さない）", async () => {
    await openScreen();

    await type("横浜駅");

    expect(candidateList().getByText("候補なし")).toBeTruthy();
    expect(candidateList().getByText(/下の一覧から区市を選んでください/)).toBeTruthy();
    expect(candidateList().queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(/都外|東京都の外/)).toBeNull();
    // 区市の直接選択は、いつでも出ている
    expect(
      within(screen.getByTestId("municipality-picker")).getAllByRole("radio"),
    ).toHaveLength(49);
  });

  it("区市を選ぶまでは保存できない（区市未確定の下書きは作れない）", async () => {
    await openScreen();
    await type("東京ドーム");

    expect(saveButton()).toBeDisabled();
    fireEvent.press(saveButton());
    expect(mockAddVisit).not.toHaveBeenCalled();
  });

  it("「東京ドーム」と入力して文京区を選ぶと、入力した文字列を場所名にして source=manual で保存できる", async () => {
    const { getPathname } = await openScreen();
    await type("  東京ドーム ");

    fireEvent.press(screen.getByRole("radio", { name: "文京区" }));
    expect(selectedMunicipality()).toHaveTextContent("文京区");
    // 入力した文字列はそのまま残る
    expect(input().props.value).toBe("  東京ドーム ");

    fireEvent.press(saveButton());

    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(getPathname()).toBe("/");
    expect(mockAddVisit).toHaveBeenCalledTimes(1);
    expect(mockAddVisit).toHaveBeenCalledWith(expect.anything(), {
      municipalityCode: "13105",
      visitedOn: "2026-10-18",
      memo: "",
      source: "manual",
      placeName: "東京ドーム",
    });
  });

  it("候補が出ていても、選ばずに区市を直接選べば手動の入力として保存できる", async () => {
    await openScreen();
    await type("上野");
    expect(candidateLabels()).toHaveLength(3);

    fireEvent.press(screen.getByRole("radio", { name: "台東区" }));
    fireEvent.press(saveButton());

    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(mockAddVisit).toHaveBeenCalledWith(expect.anything(), {
      municipalityCode: "13106",
      visitedOn: "2026-10-18",
      memo: "",
      source: "manual",
      placeName: "上野",
    });
  });

  it("入力が空白だけなら、区市だけを選んだときと同じく場所名に区市名を入れる", async () => {
    await openScreen();
    await type("   ");
    fireEvent.press(screen.getByRole("radio", { name: "港区" }));
    fireEvent.press(saveButton());

    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(mockAddVisit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ placeName: "港区", source: "manual" }),
    );
  });
});
