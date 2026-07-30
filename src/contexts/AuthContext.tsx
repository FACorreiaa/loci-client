import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  onCleanup,
  onMount,
  JSX,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import { getAuthToken, setAuthToken, clearAuthToken, isPersistentSession } from "~/lib/auth/tokens";
import { isDeadSession } from "~/lib/auth/session-failure";
import { onAuthExpired } from "~/lib/auth/auth-events";
import { authAPI } from "~/lib/api";

interface User {
  id: string;
  email: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  age?: number;
  city?: string;
  country?: string;
  about_you?: string;
  display_name?: string;
  profile_image_url?: string;
  is_active: boolean;
  email_verified_at?: string;
  last_login_at?: string;
  theme?: string;
  language?: string;
  role?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  isLoading: () => boolean;
  /**
   * True once the initial session-restore attempt has finished, whatever its
   * outcome. Route guards must wait for this before deciding to redirect - the
   * restore is async, so `isAuthenticated()` is transiently false before it.
   */
  authReady: () => boolean;
  /**
   * Set when session restore failed for a reason that is NOT "your session is
   * dead" (server down, network blip, CORS). Tokens are kept in that case and
   * `retryAuth()` can recover.
   */
  authError: () => string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  retryAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: JSX.Element;
}

export const AuthProvider = (props: AuthProviderProps) => {
  const navigate = useNavigate();
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [authReady, setAuthReady] = createSignal(false);
  const [authError, setAuthError] = createSignal<string | null>(null);

  // Add a retry function for auth restoration
  const retryAuth = async () => {
    const token = getAuthToken();
    if (!token || user()) return;

    try {
      const userProfile = await authAPI.getCurrentUser();
      setUser(userProfile);
      setAuthError(null);
    } catch (error) {
      console.error("Auth retry failed:", error);
      if (isDeadSession(error)) {
        clearAuthToken();
        setAuthError(null);
      } else {
        setAuthError("Could not reach the server. Retrying when the connection is back.");
      }
    }
  };

  // Check authentication status on mount
  onMount(async () => {
    console.log("AuthProvider: Initializing authentication state...");

    // PWA Hydration Delay: Wait for storage to be available
    // This prevents race conditions where SSR hydration clears state before client localStorage is accessible
    if (typeof window !== "undefined") {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const token = getAuthToken();
    const useLocalStorage = isPersistentSession();
    console.log("AuthProvider: Token found?", !!token, "Persistent?", useLocalStorage);

    if (!token) {
      console.log("AuthProvider: No token found");
      setUser(null);
      setIsLoading(false);
      setAuthReady(true);
      console.log("AuthProvider: Initialization complete");
      return;
    }

    const loadUserProfile = async () => {
      console.log("AuthProvider: Restoring session by fetching user profile...");
      const userProfile = await authAPI.getCurrentUser();
      console.log("AuthProvider: User profile fetched:", userProfile);
      setUser(userProfile);
    };

    try {
      await loadUserProfile();
    } catch (error) {
      // The Connect transport is the single refresh authority: its
      // tokenRefreshInterceptor already attempts one token refresh + retry on a
      // 401 before this throws. Doing a SECOND manual refresh here raced that
      // rotation — both paths spent the same refresh token, the loser was
      // rejected (the server deletes the old session on rotation), and the user
      // was logged out mid-navigation.
      //
      // But only an Unauthenticated response means the session is dead. Any
      // other failure - server down, cold start, network blip, CORS - used to
      // land here too and wipe perfectly valid tokens, which is what made
      // "every page refresh signs me out" reproducible. Keep the tokens and let
      // retryAuth() recover.
      console.error("AuthProvider: Session restoration failed:", error);
      if (isDeadSession(error)) {
        clearAuthToken();
        setUser(null);
      } else {
        setUser(null);
        setAuthError("Could not reach the server. Retrying when the connection is back.");
      }
    }

    setIsLoading(false);
    setAuthReady(true);
    console.log("AuthProvider: Initialization complete");
  });

  // Recover from a transient restore failure without making the user re-login:
  // retry when the tab regains focus or the browser comes back online.
  createEffect(() => {
    if (typeof window === "undefined") return;

    const retry = () => {
      if (authError() && !user() && getAuthToken()) void retryAuth();
    };

    window.addEventListener("focus", retry);
    window.addEventListener("online", retry);
    onCleanup(() => {
      window.removeEventListener("focus", retry);
      window.removeEventListener("online", retry);
    });
  });

  // Listen for token changes to handle cross-tab authentication
  createEffect(() => {
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === "access_token" || e.key === null) {
        const token = getAuthToken();
        if (!token && user()) {
          // Token was cleared in another tab
          setUser(null);
          navigate("/auth/signin");
        } else if (token && !user()) {
          // Token was set in another tab, fetch profile
          try {
            const userProfile = await authAPI.getCurrentUser();
            setUser(userProfile);
          } catch (error) {
            console.error("Cross-tab session validation failed:", error);
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  });

  // Soft logout: the Connect transport signals this when a token refresh has
  // genuinely failed. Clear in-memory state and navigate via the router (no
  // full page reload) so we don't drop session/streaming state mid-flow.
  createEffect(() => {
    const off = onAuthExpired(() => {
      clearAuthToken();
      setUser(null);
      setIsLoading(false);
      if (typeof window !== "undefined" && !window.location.pathname.includes("/auth/")) {
        const returnTo = window.location.pathname + window.location.search;
        sessionStorage.setItem("auth_return_to", returnTo);
        navigate(`/auth/signin?returnTo=${encodeURIComponent(returnTo)}`);
      }
    });
    onCleanup(off);
  });

  const login = async (
    email: string,
    password: string,
    rememberMe: boolean = false,
  ): Promise<void> => {
    setIsLoading(true);
    try {
      console.log("AuthProvider: Login attempt for:", email, "Remember me:", rememberMe);
      // Authenticate with server and get access token
      const response = await authAPI.login(email, password);
      console.log("AuthProvider: Login successful, response:", response);

      const { access_token, refresh_token, user_id, username, email: userEmail } = response;
      setAuthToken(access_token, rememberMe, refresh_token);

      // Build display name with proper fallbacks
      const displayName = username || userEmail?.split("@")[0] || email.split("@")[0];

      console.log(
        "AuthProvider: Setting user with id:",
        user_id,
        "username:",
        username,
        "display_name:",
        displayName,
      );
      setUser({
        id: user_id || "",
        email: userEmail || email,
        username: username || "",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: "user",
        firstname: "",
        lastname: "",
        display_name: displayName,
      });

      console.log("AuthProvider: User set, navigating...");
      setIsLoading(false);
      setAuthError(null);
      setAuthReady(true);
      const stored =
        typeof window !== "undefined" ? sessionStorage.getItem("auth_return_to") : null;
      if (stored) {
        sessionStorage.removeItem("auth_return_to");
        navigate(stored);
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("AuthProvider: Login failed:", error);
      setIsLoading(false);
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      // Register new user with server
      await authAPI.register(username, email, password);
      // After successful registration, automatically log in the user
      await login(email, password);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Call server logout endpoint to invalidate session
      await authAPI.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear local authentication state
      clearAuthToken();
      setUser(null);
      setIsLoading(false);
      setAuthError(null);
      setAuthReady(true);
      navigate("/auth/signin");
    }
  };

  const updatePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    await authAPI.updatePassword(oldPassword, newPassword);
  };

  const isAuthenticated = () => !!user();

  const authValue: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    authReady,
    authError,
    login,
    register,
    logout,
    updatePassword,
    retryAuth,
  };

  return <AuthContext.Provider value={authValue}>{props.children}</AuthContext.Provider>;
};

// Protected Route Component
interface ProtectedRouteProps {
  children: JSX.Element;
  fallback?: JSX.Element;
}

export const ProtectedRoute = (props: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, authReady } = useAuth();
  const navigate = useNavigate();

  createEffect(() => {
    // authReady - not isLoading - is the signal that the restore attempt is
    // over. Redirecting on isLoading alone bounced logged-in users mid-restore.
    if (authReady() && !isLoading() && !isAuthenticated()) {
      // Remember where they were so sign-in can send them back instead of
      // dumping them on the dashboard (e.g. opening a saved itinerary).
      if (typeof window !== "undefined" && !window.location.pathname.includes("/auth/")) {
        sessionStorage.setItem("auth_return_to", window.location.pathname + window.location.search);
      }
      navigate("/auth/signin", { replace: true });
    }
  });

  if (isLoading() || !authReady()) {
    // eslint-disable-next-line solid/components-return-once
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated()) {
    // eslint-disable-next-line solid/components-return-once
    return (
      props.fallback || (
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-center">
            <h2 class="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p class="text-gray-600">You need to be logged in to access this page.</p>
          </div>
        </div>
      )
    );
  }

  return <>{props.children}</>;
};

// Public Route Component (redirects authenticated users)
interface PublicRouteProps {
  children: JSX.Element;
  redirectTo?: string;
}

export const PublicRoute = (props: PublicRouteProps) => {
  const { isAuthenticated, isLoading, authReady } = useAuth();
  const navigate = useNavigate();

  createEffect(() => {
    if (authReady() && !isLoading() && isAuthenticated()) {
      navigate(props.redirectTo || "/");
    }
  });

  if (isLoading() || !authReady()) {
    // eslint-disable-next-line solid/components-return-once
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <>{props.children}</>;
};
