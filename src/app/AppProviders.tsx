import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import type { ReactNode } from "react";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return <FluentProvider theme={webLightTheme}>{children}</FluentProvider>;
}
