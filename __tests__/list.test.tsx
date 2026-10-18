import { render, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { ConquestCount } from "../src/components/ConquestCount";
import { MUNICIPALITIES } from "../src/data/municipalities";

describe("一覧タブ", () => {
  it("制覇数「0 / 49」が出る", async () => {
    renderRouter("./app", { initialUrl: "/list" });

    expect(await screen.findByText("0 / 49")).toBeTruthy();
    // 分母はマスタの件数から求めた値
    expect(screen.getByText(`0 / ${MUNICIPALITIES.length}`)).toBeTruthy();
  });

  it("49区市の名称が JIS コード順にすべて描画され、先頭は千代田区・末尾は西東京市", async () => {
    renderRouter("./app", { initialUrl: "/list" });
    await screen.findByTestId("list-screen");

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

describe("ConquestCount", () => {
  it("渡された数値を「訪問済み / 全体」の形で表示する", () => {
    render(<ConquestCount visited={3} total={49} />);
    expect(screen.getByText("3 / 49")).toBeTruthy();
  });
});
