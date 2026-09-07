import { Button } from "@/ui/button";
import { TextField, TextFieldRoot } from "@/ui/textfield";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { FiCheck, FiLock } from "solid-icons/fi";
import { Component, createSignal, Show, onMount } from "solid-js";
import AuthLayout from "../../layout/Auth";
import { useResetPasswordMutation } from "~/lib/api/auth-connect";
import { type AuthErrorField, describeAuthError } from "~/lib/auth/auth-errors";

const inputClass =
  "w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all";
const inputErrorClass =
  "!border-destructive !ring-destructive focus:!ring-destructive focus:!border-destructive";

const ResetPassword: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [passwordReset, setPasswordReset] = createSignal(false);
  const [passwordError, setPasswordError] = createSignal("");
  const [confirmError, setConfirmError] = createSignal("");
  const [generalError, setGeneralError] = createSignal("");
  // Set when the server, rather than our own validation, blamed a field.
  const [serverField, setServerField] = createSignal<AuthErrorField>(null);

  const resetPasswordMutation = useResetPasswordMutation();

  const token = (): string => {
    const t = searchParams.token;
    if (!t) return "";
    return Array.isArray(t) ? t[0] : String(t);
  };

  onMount(() => {
    if (!token()) {
      setGeneralError("This reset link is incomplete. Request a new one from the sign-in page.");
    }
  });

  const validatePassword = (pwd: string): boolean => {
    if (!pwd.trim()) {
      setPasswordError("Enter a new password.");
      return false;
    }
    if (pwd.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return false;
    }
    if (!/[A-Z]/.test(pwd)) {
      setPasswordError("Password must contain at least one uppercase letter");
      return false;
    }
    if (!/[a-z]/.test(pwd)) {
      setPasswordError("Password must contain at least one lowercase letter");
      return false;
    }
    if (!/[0-9]/.test(pwd)) {
      setPasswordError("Password must contain at least one digit");
      return false;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      setPasswordError("Password must contain at least one special character");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const validateConfirmPassword = (): boolean => {
    if (password() !== confirmPassword()) {
      setConfirmError("Those passwords don't match.");
      return false;
    }
    setConfirmError("");
    return true;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setGeneralError("");
    setServerField(null);

    if (!token()) {
      setGeneralError("This reset link is incomplete. Request a new one from the sign-in page.");
      return;
    }

    const pwdValid = validatePassword(password());
    const confirmValid = validateConfirmPassword();

    if (!pwdValid || !confirmValid) {
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync({
        token: token(),
        newPassword: password(),
      });
      setPasswordReset(true);
    } catch (err: unknown) {
      // Was `err.message` verbatim, which put the server's own wording — and the
      // Connect code in front of it — on the page.
      const { message, field } = describeAuthError(err, "reset-password");
      setGeneralError(message);
      setServerField(field);
    }
  };

  const handleBackToSignIn = () => {
    navigate("/auth/signin");
  };

  return (
    <AuthLayout showBackButton onBack={handleBackToSignIn}>
      <Show
        when={!passwordReset()}
        fallback={
          <div class="text-center space-y-4">
            <div class="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto border border-primary/30">
              <FiCheck class="w-8 h-8 text-primary" />
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground">Password reset!</h1>
            <p class="text-muted-foreground">
              Your password has been successfully reset.
              <br />
              You can now sign in with your new password.
            </p>
            <Button
              onClick={handleBackToSignIn}
              class="w-full py-3 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
            >
              Sign in
            </Button>
          </div>
        }
      >
        <div class="text-left mb-6 space-y-2">
          <div class="flex items-center gap-2 mb-2">
            <FiLock class="w-5 h-5 text-primary" />
            <p class="text-xs uppercase tracking-[0.2em] text-primary">Secure reset</p>
          </div>
          <h1 class="text-2xl font-bold text-foreground tracking-tight">Create new password</h1>
          <p class="text-muted-foreground">Enter your new password below.</p>
        </div>

        <Show when={generalError()}>
          <div class="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p class="text-sm text-destructive">{generalError()}</p>
          </div>
        </Show>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-semibold mb-2 text-foreground">New password</label>
            <TextFieldRoot>
              <TextField
                type="password"
                placeholder="Enter new password"
                value={password()}
                onInput={(e) => {
                  setPassword(e.currentTarget.value);
                  if (passwordError()) setPasswordError("");
                  if (generalError()) setGeneralError("");
                  setServerField(null);
                }}
                class={`${inputClass} ${passwordError() || serverField() === "password" ? inputErrorClass : ""}`}
              />
            </TextFieldRoot>
            <Show when={passwordError()}>
              <p class="mt-1.5 text-sm text-destructive">{passwordError()}</p>
            </Show>
          </div>

          <div>
            <label class="block text-sm font-semibold mb-2 text-foreground">Confirm password</label>
            <TextFieldRoot>
              <TextField
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword()}
                onInput={(e) => {
                  setConfirmPassword(e.currentTarget.value);
                  if (confirmError()) setConfirmError("");
                  if (generalError()) setGeneralError("");
                  setServerField(null);
                }}
                class={`${inputClass} ${confirmError() ? inputErrorClass : ""}`}
              />
            </TextFieldRoot>
            <Show when={confirmError()}>
              <p class="mt-1.5 text-sm text-destructive">{confirmError()}</p>
            </Show>
          </div>

          <p class="text-xs text-muted-foreground">
            Password must be at least 8 characters with uppercase, lowercase, digit, and special
            character.
          </p>

          <Button
            type="submit"
            disabled={resetPasswordMutation.isPending || !token()}
            class="w-full py-3 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
          >
            {resetPasswordMutation.isPending ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      </Show>
    </AuthLayout>
  );
};

export default ResetPassword;
