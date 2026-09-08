// Client-side token helpers used across the app

import { notifyAuthEstablished } from "./auth-events";

/**
 * Get the persisted access token from localStorage or sessionStorage.
 */
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
};

/**
 * Get the persisted refresh token from localStorage or sessionStorage.
 */
export const getRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token") || sessionStorage.getItem("refresh_token");
};

/**
 * Persist access/refresh tokens in the selected storage (local vs session).
 */
export const setAuthToken = (
  token: string,
  rememberMe: boolean = false,
  refreshToken?: string,
): void => {
  if (typeof window === "undefined") return;

  const primaryStorage = rememberMe ? localStorage : sessionStorage;
  const secondaryStorage = rememberMe ? sessionStorage : localStorage;

  primaryStorage.setItem("access_token", token);
  if (refreshToken) {
    primaryStorage.setItem("refresh_token", refreshToken);
  }

  secondaryStorage.removeItem("access_token");
  secondaryStorage.removeItem("refresh_token");

  // Storing a token IS the moment a session begins, so this is the one place
  // that has to announce it. Announcing from each caller instead is what left
  // the OAuth paths silent: they wrote tokens and never told AuthContext, so
  // `user` stayed null and the route gate showed the landing page until a
  // manual refresh. See notifyAuthEstablished for why delivery is deferred.
  notifyAuthEstablished();
};

/**
 * Clear all stored auth tokens.
 */
export const clearAuthToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  sessionStorage.removeItem("refresh_token");
};

/**
 * Determine whether the current stored session is persistent (localStorage) or
 * temporary (sessionStorage).
 */
export const isPersistentSession = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("access_token") || !!localStorage.getItem("refresh_token");
};

/**
 * Simple authenticated flag.
 */
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};
