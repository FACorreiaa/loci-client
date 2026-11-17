export type DesignTheme = "classic" | "modern" | "loci";
export type ColorTheme = "light" | "dark" | "system";

export interface ThemePreference {
  design: DesignTheme;
  color: ColorTheme;
}

const DESIGN_THEMES = new Set<string>(["classic", "modern", "loci"] satisfies DesignTheme[]);
const COLOR_THEMES = new Set<string>(["light", "dark", "system"] satisfies ColorTheme[]);

const isDesignTheme = (value: string): value is DesignTheme => DESIGN_THEMES.has(value);

const isColorTheme = (value: string): value is ColorTheme => COLOR_THEMES.has(value);

export const systemPrefersDark = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

export const resolveIsDark = (color: ColorTheme): boolean => {
  if (color === "system") return systemPrefersDark();
  return color === "dark";
};

/** Encodes design + color as `loci:dark` or `classic:system` for API persistence. */
export const serializeThemePreference = (pref: ThemePreference): string =>
  `${pref.design}:${pref.color}`;

/** Parses `loci:dark` from the user profile theme field. */
export const parseThemePreference = (value?: string | null): ThemePreference | null => {
  if (!value) return null;

  const [design, color] = value.split(":");
  if (!design || !color || !isDesignTheme(design) || !isColorTheme(color)) {
    return null;
  }

  return { design, color };
};

export const themePreferenceFromLocalStorage = (): ThemePreference | null => {
  if (typeof window === "undefined") return null;

  const design = localStorage.getItem("designTheme");
  const color = localStorage.getItem("theme");

  if (!design || !isDesignTheme(design)) return null;
  if (color === "dark" || color === "light" || color === "system") {
    return { design, color };
  }

  return null;
};
