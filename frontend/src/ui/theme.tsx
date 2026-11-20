import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** The appearance of the interface: the one of the system, which is the first, or one that the person chose (BR-10). */
export type Mode = "system" | "light" | "dark";

interface Theme {
  readonly mode: Mode;
  readonly setMode: (mode: Mode) => void;
}

const ThemeContext = createContext<Theme | null>(null);

/**
 * Keeps the mode in memory and shows it as the attribute `data-theme` of the page, which the tokens of `index.css`
 * read. The system has no attribute, so the media query of the browser decides. Nothing is stored (D8 of the design,
 * and BR-01 of feature 09): a page that is loaded again starts with the system.
 */
export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const page = document.documentElement;
    if (mode === "system") page.removeAttribute("data-theme");
    else page.setAttribute("data-theme", mode);
    // Whatever shows the page without this provider goes back to the system.
    return () => page.removeAttribute("data-theme");
  }, [mode]);

  const theme = useMemo(() => ({ mode, setMode }), [mode]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) throw new Error("useTheme needs a ThemeProvider");
  return theme;
}
