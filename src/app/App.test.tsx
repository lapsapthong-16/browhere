import { render, screen } from "@testing-library/react";

import { App } from "./App";

describe("App", () => {
  it("renders a first-screen desktop search surface", () => {
    render(<App />);

    expect(
      screen.getByRole("searchbox", { name: /describe the file/i }),
    ).toHaveFocus();
    expect(
      screen.getByRole("heading", { name: /search your files/i }),
    ).toBeInTheDocument();
  });
});
