import { screens } from "../texts";
import { useTheme, type Mode } from "./theme";

const MODES: readonly Mode[] = ["system", "light", "dark"];

/** The choice of the appearance (BR-10): it applies at once and is not kept. */
export function ThemeSelector() {
  const { mode, setMode } = useTheme();
  return (
    <select
      aria-label={screens.theme.label}
      value={mode}
      onChange={(event) => setMode(event.target.value as Mode)}
      className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {MODES.map((option) => (
        <option key={option} value={option}>
          {screens.theme[option]}
        </option>
      ))}
    </select>
  );
}
