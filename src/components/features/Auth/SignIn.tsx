// SignIn.tsx
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";
import { Checkbox, CheckboxControl } from "~/ui/checkbox";
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { Component, createSignal, Show } from "solid-js";
import { VsEye, VsEyeClosed } from "solid-icons/vs";
import AuthLayout from "~/components/layout/Auth";
import { useAuth } from "~/contexts/AuthContext";
import { useGoogleLoginMutation, useAppleLoginMutation } from "~/lib/api/custom-auth";

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

const inputBase =
  "w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-all text-sm sm:text-base border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SignIn: Component = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = createSignal<Partial<FormData>>({
    email: "",
    password: "",
    rememberMe: true,
  });
  const [error, setError] = createSignal<string>("");
  const [hasAuthError, setHasAuthError] = createSignal(false);
  const [showPassword, setShowPassword] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [socialLoading, setSocialLoading] = createSignal<string | null>(null);

  const googleLoginMutation = useGoogleLoginMutation();
  const appleLoginMutation = useAppleLoginMutation();

  const afterAuthNavigate = () => {
    const returnTo = (searchParams.returnTo as string) || sessionStorage.getItem("auth_return_to");
    if (returnTo) {
      sessionStorage.removeItem("auth_return_to");
      navigate(returnTo);
      return;
    }
    navigate("/");
  };

  const handleGoogleLogin = async () => {
    setSocialLoading("google");
    setError("");
    setHasAuthError(false);
    try {
      await googleLoginMutation.mutateAsync();
      afterAuthNavigate();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error?.message || "Google sign-in failed. Please try again.");
      setHasAuthError(true);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    setSocialLoading("apple");
    setError("");
    setHasAuthError(false);
    try {
      await appleLoginMutation.mutateAsync();
      afterAuthNavigate();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error?.message || "Apple sign-in failed. Please try again.");
      setHasAuthError(true);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setHasAuthError(false);

    const data = formData();

    if (!data.email || !data.password) {
      setError("Please fill in all required fields");
      setHasAuthError(true);
      setIsLoading(false);
      return;
    }

    try {
      await login(data.email, data.password, data.rememberMe || false);
    } catch (err: any) {
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (err && err.message) {
        const lowerCaseMessage = err.message.toLowerCase();

        if (lowerCaseMessage.includes("failed to fetch")) {
          errorMessage =
            "Could not connect to the server. Please ensure it is running and accessible.";
        } else if (
          lowerCaseMessage.includes("invalid credentials") ||
          lowerCaseMessage.includes("unauthenticated")
        ) {
          errorMessage = "Invalid email or password. Please check your details and try again.";
        } else if (
          lowerCaseMessage.includes("internal server error") ||
          lowerCaseMessage.includes("nil pointer")
        ) {
          errorMessage =
            "The server encountered an error. Please try again later or contact support.";
        } else if (lowerCaseMessage.includes("user not found")) {
          errorMessage = "No account found with this email address.";
        } else if (lowerCaseMessage.includes("account is deactivated")) {
          errorMessage = "Your account has been deactivated. Please contact support.";
        } else {
          errorMessage = err.message.replace(/\[.*?\]\s*/, "");
          errorMessage = errorMessage.charAt(0).toUpperCase() + errorMessage.slice(1);
        }
      }

      setError(errorMessage);
      setHasAuthError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getInputClass = () =>
    hasAuthError()
      ? `${inputBase} border-2 border-destructive focus:ring-2 focus:ring-destructive`
      : `${inputBase} border-border focus:ring-2 focus:ring-ring focus:border-transparent`;

  return (
    <AuthLayout>
      <div class="text-left mb-6 space-y-2">
        <p class="text-xs uppercase tracking-[0.2em] text-primary">Sign back in</p>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight leading-tight text-foreground">
          Continue planning with your taste profile.
        </h1>
        <p class="text-muted-foreground text-sm sm:text-base">
          Search stays free. Chat, saves, and sync unlock here.
        </p>
      </div>

      <form onSubmit={handleSubmit} class="space-y-3 sm:space-y-4">
        <Show when={error()}>
          <div class="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
            <p class="text-sm">{error()}</p>
          </div>
        </Show>
        <div>
          <Label class="block text-xs sm:text-sm font-semibold mb-1 sm:mb-2 text-foreground">
            Email address
          </Label>
          <TextFieldRoot>
            <TextField
              type="email"
              placeholder="Enter your email"
              value={formData().email || ""}
              onInput={(e) => {
                setFormData((prev) => ({ ...prev, email: e.currentTarget.value }));
                if (hasAuthError()) {
                  setHasAuthError(false);
                  setError("");
                }
              }}
              class={getInputClass()}
              required
            />
          </TextFieldRoot>
        </div>

        <div>
          <Label class="block text-xs sm:text-sm font-semibold mb-1 sm:mb-2 text-foreground">
            Password
          </Label>
          <div class="relative">
            <TextFieldRoot>
              <TextField
                type={showPassword() ? "text" : "password"}
                placeholder="Enter your password"
                value={formData().password || ""}
                onInput={(e) => {
                  setFormData((prev) => ({ ...prev, password: e.currentTarget.value }));
                  if (hasAuthError()) {
                    setHasAuthError(false);
                    setError("");
                  }
                }}
                class={`${getInputClass()} pr-10 sm:pr-12`}
                required
              />
            </TextFieldRoot>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => setShowPassword(!showPassword())}
              class="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
            >
              {showPassword() ? (
                <VsEyeClosed class="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <VsEye class="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </Button>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 text-xs sm:text-sm">
          <Checkbox
            checked={formData().rememberMe ?? true}
            onChange={(checked) => setFormData((prev) => ({ ...prev, rememberMe: checked }))}
            class="flex items-center gap-2"
          >
            <CheckboxControl />
            <span class="text-muted-foreground">Remember me</span>
          </Checkbox>
          <A
            href="/auth/forgot-password"
            class="text-primary hover:text-primary/80 underline-offset-4"
          >
            Forgot password?
          </A>
        </div>

        <Button
          type="submit"
          disabled={isLoading()}
          class="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
        >
          {isLoading() ? "Signing in..." : "Sign in"}
        </Button>

        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-border" />
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 rounded-full backdrop-blur bg-muted text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="outline"
            class="py-2.5 sm:py-3 text-sm sm:text-base bg-card border border-border text-foreground hover:bg-muted"
            onClick={handleGoogleLogin}
            disabled={socialLoading() !== null || isLoading()}
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {socialLoading() === "google" ? "Signing in..." : "Google"}
          </Button>
          <Button
            variant="outline"
            class="py-2.5 sm:py-3 text-sm sm:text-base bg-card border border-border text-foreground hover:bg-muted"
            onClick={handleAppleLogin}
            disabled={socialLoading() !== null || isLoading()}
          >
            <svg
              class="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            {socialLoading() === "apple" ? "Signing in..." : "Apple"}
          </Button>
        </div>
      </form>

      <div class="text-center mt-4 sm:mt-6">
        <span class="text-muted-foreground text-sm sm:text-base">Don't have an account? </span>
        <A
          href="/auth/signup"
          class="text-primary hover:text-primary/80 underline-offset-4 font-semibold text-sm sm:text-base"
        >
          Sign up
        </A>
      </div>
    </AuthLayout>
  );
};

export default SignIn;
