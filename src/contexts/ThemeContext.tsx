import { createContext, useContext, createSignal, createEffect, onMount, JSX } from "solid-js";
import {
  type ColorTheme,
  type DesignTheme,
  type ThemePreference,
  parseThemePreference,
  resolveIsDark,
  serializeThemePreference,
  themePreferenceFromLocalStorage,
} from "~/lib/theme-preference";

interface ThemeContextType {
  isDark: () => boolean;
  colorMode: () => ColorTheme;
  toggleTheme: () => void;
  setTheme: (theme: ColorTheme) => void;
  designTheme: () => DesignTheme;
  setDesignTheme: (theme: DesignTheme) => void;
  applyThemePreference: (pref: ThemePreference, options?: { persistLocal?: boolean }) => void;
  getThemePreference: () => ThemePreference;
}

const ThemeContext = createContext<ThemeContextType>();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: JSX.Element;
}

const applyToDocument = (isDark: boolean, _design: DesignTheme) => {
  const html = document.documentElement;
  const body = document.body;

  html.classList.remove("dark");
  body.classList.remove("dark");
  html.removeAttribute("data-theme");

  if (isDark) {
    html.classList.add("dark");
    body.classList.add("dark");
    html.setAttribute("data-kb-theme", "dark");
  } else {
    html.setAttribute("data-kb-theme", "light");
  }

  html.setAttribute("data-theme", "loci");
};

const persistLocalThemePreference = (pref: ThemePreference) => {
  localStorage.setItem("theme", pref.color);
  localStorage.setItem("designTheme", "loci");
};

export const ThemeProvider = (props: ThemeProviderProps) => {
  const [colorMode, setColorMode] = createSignal<ColorTheme>("system");
  const [isDark, setIsDark] = createSignal(false);
  const [designTheme, setDesignThemeSignal] = createSignal<DesignTheme>("loci");
  const [initialized, setInitialized] = createSignal(false);

  const syncResolvedDark = (mode: ColorTheme) => {
    setIsDark(resolveIsDark(mode));
  };

  const applyThemePreference = (
    pref: ThemePreference,
    options: { persistLocal?: boolean } = {},
  ) => {
    setColorMode(pref.color);
    setDesignThemeSignal("loci");
    syncResolvedDark(pref.color);

    if (options.persistLocal !== false) {
      persistLocalThemePreference(pref);
    }
  };

  const getThemePreference = (): ThemePreference => ({
    design: designTheme(),
    color: colorMode(),
  });

  onMount(() => {
    const savedPreference = themePreferenceFromLocalStorage();
    if (savedPreference) {
      applyThemePreference(savedPreference, { persistLocal: false });
    } else {
      const saved = localStorage.getItem("theme");
      const mode: ColorTheme =
        saved === "dark" || saved === "light" || saved === "system" ? saved : "dark";

      setColorMode(mode);
      setDesignThemeSignal("loci");
      syncResolvedDark(mode);
    }

    setInitialized(true);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (colorMode() === "system") {
        setIsDark(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  });

  createEffect(() => {
    if (!initialized()) return;
    applyToDocument(isDark(), designTheme());
  });

  const toggleTheme = () => {
    const nextColor: ColorTheme = isDark() ? "light" : "dark";
    applyThemePreference({ design: designTheme(), color: nextColor });
  };

  const setTheme = (theme: ColorTheme) => {
    applyThemePreference({ design: designTheme(), color: theme });
  };

  const setDesignTheme = (theme: DesignTheme) => {
    void theme;
    applyThemePreference({ design: "loci", color: colorMode() });
  };

  const themeValue: ThemeContextType = {
    isDark,
    colorMode,
    toggleTheme,
    setTheme,
    designTheme,
    setDesignTheme,
    applyThemePreference,
    getThemePreference,
  };

  return <ThemeContext.Provider value={themeValue}>{props.children}</ThemeContext.Provider>;
};

/** Apply a stored profile theme value (e.g. `loci:dark`). */
export const applyProfileTheme = (
  themeValue: string | undefined,
  applyThemePreference: ThemeContextType["applyThemePreference"],
) => {
  const parsed = parseThemePreference(themeValue);
  if (!parsed) return false;
  applyThemePreference(parsed);
  return true;
};

/** Serialize the active theme for profile persistence. */
export const toProfileThemeValue = (getThemePreference: ThemeContextType["getThemePreference"]) =>
  serializeThemePreference(getThemePreference());
