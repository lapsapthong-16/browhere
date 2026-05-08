import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

import { AppProviders } from "../app/AppProviders";

export function renderWithAppProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AppProviders, ...options });
}

export * from "@testing-library/react";
