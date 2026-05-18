import type { PropsWithChildren } from "react";

import { ThemeProvider } from "./components/ui/theme-provider";

function App({ children }: PropsWithChildren) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {children}
    </ThemeProvider>
  );
}

export default App;
