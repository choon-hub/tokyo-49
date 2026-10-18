import { act, create } from "react-test-renderer";

import Home from "../app/index";

describe("Home", () => {
  it("renders without crashing", async () => {
    await act(async () => {
      create(<Home />);
    });
  });
});
