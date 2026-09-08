import { Button } from "@/ui/button";
import { TextField, TextFieldRoot } from "@/ui/textfield";
import { A, useNavigate } from "@solidjs/router";
import { Component, createSignal, Show, For, createMemo } from "solid-js";
import AuthLayout from "../../layout/Auth";
import { FiCheck, FiX } from "solid-icons/fi";
import { VsEyeClosed, VsEye } from "solid-icons/vs";
import { useRegisterMutation } from "~/lib/api/auth";
import { useGoogleLoginMutation, useAppleLoginMutation } from "~/lib/api/custom-auth";
import { type AuthErrorField, describeAuthError } from "~/lib/auth/auth-errors";
import { capture } from "~/lib/analytics";

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
}

const inputBase =
  "w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground transition-all text-sm sm:text-base backdrop-blur";

const SignUp: Component = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = createSignal<Partial<FormData>>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = createSignal(false);
  const [error, setError] = createSignal<string>("");
  // `error` is the sentence; `fieldError` names the one input at fault. This
  // form had no field marking at all, so "Passwords do not match" left the user
  // to guess which of the two boxes to look at.
  const [fieldError, setFieldError] = createSignal<AuthErrorField>(null);
  const [socialLoading, setSocialLoading] = createSignal<string | null>(null);

  const clearErrors = () => {
    setError("");
    setFieldError(null);
  };

  const showAuthError = (err: unknown, action: Parameters<typeof describeAuthError>[1]) => {
    const { message, field } = describeAuthError(err, action);
    setError(message);
    setFieldError(field);
  };

  // border-input, not border-border. They are the same value today, which is why
  // nobody noticed, but --input is the token meant to give a text field a
  // boundary a person can see, and --border is for decorative hairlines. The
  // moment the palette makes them differ, an input drawn with --border loses
  // the contrast that identifies it as something you can type into.
  const getInputClass = (field: Exclude<AuthErrorField, null>) =>
    fieldError() === field
      ? `${inputBase} border-2 border-destructive focus:ring-2 focus:ring-destructive`
      : `${inputBase} border-input focus:ring-2 focus:ring-ring focus:border-transparent`;

  const registerMutation = useRegisterMutation();
  const googleLoginMutation = useGoogleLoginMutation();
  const appleLoginMutation = useAppleLoginMutation();

  const handleGoogleLogin = async () => {
    setSocialLoading("google");
    clearErrors();
    try {
      await googleLoginMutation.mutateAsync();
      navigate("/");
    } catch (err: unknown) {
      showAuthError(err, "google");
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    setSocialLoading("apple");
    clearErrors();
    try {
      await appleLoginMutation.mutateAsync();
      navigate("/");
    } catch (err: unknown) {
      showAuthError(err, "apple");
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    clearErrors();

    const data = formData();

    // Name the empty box rather than marking all of them, in the order they
    // appear so the mark lands on the first one the user would reach. Written
    // as separate guards rather than a loop because these also narrow
    // formData's Partial fields for the request below.
    if (!data.username) {
      setError("Choose a username.");
      setFieldError("username");
      return;
    }
    if (!data.email) {
      setError("Enter your email address.");
      setFieldError("email");
      return;
    }
    if (!data.password) {
      setError("Create a password.");
      setFieldError("password");
      return;
    }

    if (data.password !== data.confirmPassword) {
      setError("Those passwords don't match.");
      setFieldError("confirmPassword");
      return;
    }

    try {
      await registerMutation.mutateAsync({
        username: data.username,
        email: data.email,
        password: data.password,
      });

      // The strangers count is measured from this event, and until now nothing
      // fired it: its only call site was AuthContext.register, which no
      // component uses. Registration succeeded and went uncounted.
      capture("signup_completed", { method: "password" });

      navigate("/auth/signin");
    } catch (err: unknown) {
      showAuthError(err, "sign-up");
    }
  };

  const passwordRequirements = createMemo(() => [
    { text: "At least 8 characters", met: (formData().password?.length || 0) >= 8 },
    { text: "Contains uppercase letter", met: /[A-Z]/.test(formData().password || "") },
    { text: "Contains lowercase letter", met: /[a-z]/.test(formData().password || "") },
    { text: "Contains number", met: /\d/.test(formData().password || "") },
    {
      text: "Contains special character (!@#$%^&*)",
      met: /[!@#$%^&*(),.?":{}|<>]/.test(formData().password || ""),
    },
  ]);

  return (
    <AuthLayout>
      <div class="text-left mb-6 space-y-2">
        <p class="text-xs uppercase tracking-[0.2em] text-primary">Create account</p>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight leading-tight text-foreground">
          Build your travel operating profile.
        </h1>
        <p class="text-muted-foreground text-sm sm:text-base">
          Save itineraries, sync devices, and keep refining your taste graph.
        </p>
      </div>

      <form onSubmit={handleSubmit} class="space-y-3 sm:space-y-4">
        <Show when={error()}>
          <div class="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
            <p class="text-sm">{error()}</p>
          </div>
        </Show>

        <div>
          <label class="block text-xs sm:text-sm font-semibold mb-1 sm:mb-2 text-foreground">
            Username
          </label>
          <TextFieldRoot>
            <TextField
              type="text"
              placeholder="John"
              value={formData().username || ""}
              onInput={(e) => {
                setFormData((prev) => ({ ...prev, username: e.currentTarget.value }));
                clearErrors();
              }}
              class={getInputClass("username")}
              required
            />
          </TextFieldRoot>
        </div>

        <div>
          <label class="block text-xs sm:text-sm font-semibold mb-1 sm:mb-2 text-foreground">
            Work email
          </label>
          <TextFieldRoot>
            <TextField
              type="email"
              placeholder="john@company.com"
              value={formData().email || ""}
              onInput={(e) => {
                setFormData((prev) => ({ ...prev, email: e.currentTarget.value }));
                clearErrors();
              }}
              class={getInputClass("email")}
              required
            />
          </TextFieldRoot>
        </div>

        <div>
          <label class="block text-xs sm:text-sm font-semibold mb-1 sm:mb-2 text-foreground">
            Password
          </label>
          <div class="relative">
            <TextFieldRoot>
              <TextField
                type={showPassword() ? "text" : "password"}
                placeholder="Create a strong password"
                value={formData().password || ""}
                onInput={(e) => {
                  setFormData((prev) => ({ ...prev, password: e.currentTarget.value }));
                  clearErrors();
                }}
                class={`${getInputClass("password")} pr-10 sm:pr-12`}
                required
              />
            </TextFieldRoot>

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword())}
              class="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
            >
              {showPassword() ? (
                <VsEyeClosed class="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <VsEye class="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
          </div>

          <label class="block text-xs sm:text-sm font-semibold mb-1 sm:mb-2 pt-2 text-foreground">
            Confirm Password
          </label>
          <div class="relative">
            <TextFieldRoot>
              <TextField
                type={showPassword() ? "text" : "password"}
                placeholder="Create a strong password"
                value={formData().confirmPassword || ""}
                onInput={(e) => {
                  setFormData((prev) => ({ ...prev, confirmPassword: e.currentTarget.value }));
                  clearErrors();
                }}
                class={`${getInputClass("confirmPassword")} pr-10 sm:pr-12`}
                required
              />
            </TextFieldRoot>

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword())}
              class="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
            >
              {showPassword() ? (
                <VsEyeClosed class="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <VsEye class="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
          </div>

          <Show when={formData().password}>
            <div class="mt-3 space-y-1.5 p-3 rounded-xl bg-muted/50 border border-border">
              <p class="text-xs font-semibold text-muted-foreground mb-2">Password Requirements</p>
              <For each={passwordRequirements()}>
                {(req) => (
                  <div class="flex items-center gap-2 text-xs">
                    <div
                      class={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                        req.met
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-destructive/10 border border-destructive/30"
                      }`}
                    >
                      <Show when={req.met} fallback={<FiX class="w-2.5 h-2.5 text-destructive" />}>
                        <FiCheck class="w-2.5 h-2.5 text-primary" />
                      </Show>
                    </div>
                    <span
                      class={`transition-colors ${
                        req.met ? "text-primary font-medium" : "text-destructive"
                      }`}
                    >
                      {req.text}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <Button
          type="submit"
          disabled={registerMutation.isPending}
          class="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
        >
          {registerMutation.isPending ? "Creating account..." : "Create account"}
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
            disabled={socialLoading() !== null}
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
            disabled={socialLoading() !== null}
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
        <span class="text-muted-foreground text-sm sm:text-base">Already have an account? </span>
        <A
          href="/auth/signin"
          class="text-primary hover:text-primary/80 underline-offset-4 font-semibold text-sm sm:text-base"
        >
          Sign in
        </A>
      </div>
    </AuthLayout>
  );
};

export default SignUp;
