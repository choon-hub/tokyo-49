import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

describe("ホーム（タブ）", () => {
  it("地図タブが選ばれた状態で始まり、「地図」「一覧」の2つのタブがある", async () => {
    const { getPathname } = renderRouter("./app");

    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(screen.queryByTestId("list-screen")).toBeNull();
    expect(getPathname()).toBe("/");

    // タブはこの2つだけで、左から「地図」「一覧」の順
    const labels = screen
      .getAllByText(/^(地図|一覧)$/)
      .map((node) => node.props.children as string);
    expect(labels).toEqual(["地図", "一覧"]);
  });

  it("「一覧」タブを押すと一覧に切り替わり、「地図」タブで地図に戻れる", async () => {
    const { getPathname } = renderRouter("./app");
    expect(await screen.findByTestId("map-screen")).toBeTruthy();

    fireEvent.press(screen.getByText("一覧"));
    expect(await screen.findByTestId("list-screen")).toBeTruthy();
    expect(getPathname()).toBe("/list");

    fireEvent.press(screen.getByText("地図"));
    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(getPathname()).toBe("/");
  });

  it("未マッチ画面の「ホームへ戻る」で地図タブに戻れる", async () => {
    const { getPathname } = renderRouter("./app", { initialUrl: "/foo" });
    expect(await screen.findByText("ページが見つかりません")).toBeTruthy();

    fireEvent.press(screen.getByText("ホームへ戻る"));
    expect(await screen.findByTestId("map-screen")).toBeTruthy();
    expect(getPathname()).toBe("/");
  });
});
