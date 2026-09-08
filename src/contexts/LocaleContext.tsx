import { createContext, createMemo, useContext, type JSX } from "solid-js";
import { useUserProfileQuery } from "~/lib/api/user";
import { useAuth } from "~/contexts/AuthContext";
import { useLanguage } from "~/contexts/LanguageContext";
import {
  DEFAULT_CURRENCY,
  formatDistance as formatDistanceRaw,
  formatPrice as formatPriceRaw,
  guessTimezone,
  type Units,
} from "~/lib/locale";

/**
 * One answer to "what does this user see".
 *
 * Units and currency come from the account, so they are the same on a phone and
 * a laptop and are readable by anything server-side that needs to render for
 * this person. Components ask this context rather than each deciding for
 * themselves — the alternative is what /favorites had, a local formatter
 * disagreeing with the shared one about whether a number was metres or
 * kilometres.
 */
interface LocaleContextType {
  /** The user's zone, or the browser's guess while none is stored. */
  timezone: () => string;
  /** True when the zone is only the browser's guess, not a stored choice. */
  timezoneIsGuess: () => boolean;
  units: () => Units;
  currency: () => string;
  /** Formats a distance **in kilometres** in the user's units. */
  formatDistance: (km: number) => string;
  formatPrice: (amount: number) => string;
}

const LocaleContext = createContext<LocaleContextType>();

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
};

export const LocaleProvider = (props: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const profileQuery = useUserProfileQuery();

  // Signed out there is no account to read, and the defaults are what the app
  // has always used. The query refuses without a token anyway; reading
  // isAuthenticated keeps this reactive to signing in rather than waiting for
  // the next fetch.
  const stored = () => (isAuthenticated() ? profileQuery.data : undefined);

  const timezone = createMemo(() => stored()?.timezone || guessTimezone());
  const timezoneIsGuess = () => !stored()?.timezone;

  const units = createMemo<Units>(() => (stored()?.units === "imperial" ? "imperial" : "metric"));

  const currency = createMemo(() => stored()?.currency || DEFAULT_CURRENCY);

  return (
    <LocaleContext.Provider
      value={{
        timezone,
        timezoneIsGuess,
        units,
        currency,
        formatDistance: (km) => formatDistanceRaw(km, units()),
        // The language choice decides grouping and symbol placement, which is
        // the half of a currency people notice when it is wrong.
        formatPrice: (amount) => formatPriceRaw(amount, currency(), language()),
      }}
    >
      {props.children}
    </LocaleContext.Provider>
  );
};
