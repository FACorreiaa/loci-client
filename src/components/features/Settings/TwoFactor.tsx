import { createSignal, Show, For, createResource } from "solid-js";
import { ShieldCheck, ShieldOff, Copy, Check, Download, RefreshCw, KeyRound } from "lucide-solid";
import QRCode from "qrcode";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";
import {
  useMFAStatus,
  useBeginMFAEnrollment,
  useConfirmMFAEnrollment,
  useDisableMFA,
  useRegenerateRecoveryCodes,
  recoveryCodesAsText,
} from "~/lib/api/mfa";

interface TwoFactorProps {
  onNotification: (message: string, type: "success" | "error") => void;
}

/** Codes are shown once. Below this, warn the user before they run out. */
const LOW_RECOVERY_CODES = 3;

function errorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return fallback;
  // Strip the Connect "[code] " prefix, which means nothing to a user.
  return raw.replace(/^\[.*?\]\s*/, "") || fallback;
}

export default function TwoFactor(props: TwoFactorProps) {
  const statusQuery = useMFAStatus();
  const beginMutation = useBeginMFAEnrollment();
  const confirmMutation = useConfirmMFAEnrollment();
  const disableMutation = useDisableMFA();
  const regenerateMutation = useRegenerateRecoveryCodes();

  const [enrollment, setEnrollment] = createSignal<{
    provisioningUri: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = createSignal("");
  const [recoveryCodes, setRecoveryCodes] = createSignal<string[] | null>(null);
  const [copiedSecret, setCopiedSecret] = createSignal(false);
  const [copiedCodes, setCopiedCodes] = createSignal(false);
  const [disableCode, setDisableCode] = createSignal("");
  const [showDisable, setShowDisable] = createSignal(false);
  const [regenerateCode, setRegenerateCode] = createSignal("");
  const [showRegenerate, setShowRegenerate] = createSignal(false);

  const status = () => statusQuery.data;

  // The QR is rendered locally from the otpauth URI. Sending the URI to an
  // external chart service would hand the TOTP secret to a third party.
  const [qrDataUrl] = createResource(
    () => enrollment()?.provisioningUri,
    async (uri) => {
      try {
        return await QRCode.toDataURL(uri, { width: 220, margin: 1 });
      } catch {
        // Manual entry of the secret still works, so a QR failure is not fatal.
        return null;
      }
    },
  );

  const handleBegin = async () => {
    try {
      const result = await beginMutation.mutateAsync();
      setEnrollment(result);
      setCode("");
    } catch (err) {
      props.onNotification(errorMessage(err, "Could not start setup."), "error");
    }
  };

  const handleConfirm = async (e: Event) => {
    e.preventDefault();
    const entered = code().trim();
    if (!entered) {
      props.onNotification("Enter the 6-digit code from your app.", "error");
      return;
    }

    try {
      const codes = await confirmMutation.mutateAsync(entered);
      setRecoveryCodes(codes);
      setEnrollment(null);
      setCode("");
      props.onNotification("Two-factor authentication is on.", "success");
    } catch (err) {
      props.onNotification(errorMessage(err, "That code was not accepted."), "error");
      setCode("");
    }
  };

  const handleDisable = async (e: Event) => {
    e.preventDefault();
    const entered = disableCode().trim();
    if (!entered) {
      props.onNotification("Enter a current code to turn this off.", "error");
      return;
    }

    try {
      // A dashed code is a recovery code; 6 digits is from the app.
      const isRecovery = entered.includes("-") || entered.length > 6;
      await disableMutation.mutateAsync(isRecovery ? { recoveryCode: entered } : { code: entered });
      setShowDisable(false);
      setDisableCode("");
      setRecoveryCodes(null);
      props.onNotification("Two-factor authentication is off.", "success");
    } catch (err) {
      props.onNotification(errorMessage(err, "Could not turn this off."), "error");
      setDisableCode("");
    }
  };

  const handleRegenerate = async (e: Event) => {
    e.preventDefault();
    const entered = regenerateCode().trim();
    if (!entered) {
      props.onNotification("Enter the 6-digit code from your app.", "error");
      return;
    }

    try {
      const codes = await regenerateMutation.mutateAsync(entered);
      setRecoveryCodes(codes);
      setShowRegenerate(false);
      setRegenerateCode("");
      props.onNotification("New recovery codes generated.", "success");
    } catch (err) {
      props.onNotification(errorMessage(err, "Could not generate new codes."), "error");
      setRegenerateCode("");
    }
  };

  const copySecret = async () => {
    const secret = enrollment()?.secret;
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const copyCodes = async () => {
    const codes = recoveryCodes();
    if (!codes) return;
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const downloadCodes = () => {
    const codes = recoveryCodes();
    if (!codes) return;

    const blob = new Blob([recoveryCodesAsText(codes)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loci-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-foreground">Two-factor authentication</h2>
        <p class="text-sm text-muted-foreground mt-1">
          Ask for a code from your phone as well as your password when you sign in.
        </p>
      </div>

      {/* Recovery codes, shown once after enrolment or regeneration. */}
      <Show when={recoveryCodes()}>
        {(codes) => (
          <div class="loci-card p-4 sm:p-5 border-2 border-primary/40">
            <div class="flex items-start gap-3">
              <KeyRound class="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div class="min-w-0 flex-1">
                <h3 class="font-semibold text-foreground">Save your recovery codes</h3>
                <p class="text-sm text-muted-foreground mt-1">
                  Each code works once, and they are shown only this one time. Keep them somewhere
                  you can reach without your phone.
                </p>

                <div class="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
                  <For each={codes()}>
                    {(c) => (
                      <div class="px-2 py-1.5 rounded bg-muted text-foreground tracking-wider">
                        {c}
                      </div>
                    )}
                  </For>
                </div>

                <div class="flex flex-wrap gap-2 mt-4">
                  <Button type="button" onClick={downloadCodes} class="gap-2">
                    <Download class="w-4 h-4" />
                    Download
                  </Button>
                  <Button type="button" variant="outline" onClick={copyCodes} class="gap-2">
                    <Show when={copiedCodes()} fallback={<Copy class="w-4 h-4" />}>
                      <Check class="w-4 h-4" />
                    </Show>
                    {copiedCodes() ? "Copied" : "Copy"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setRecoveryCodes(null)}>
                    I've saved them
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Enrolment in progress: QR + manual secret + confirmation. */}
      <Show when={enrollment()}>
        {(pending) => (
          <div class="loci-card p-4 sm:p-5">
            <h3 class="font-semibold text-foreground">Scan this with your authenticator app</h3>
            <p class="text-sm text-muted-foreground mt-1">
              Google Authenticator, 1Password, Authy — any TOTP app works.
            </p>

            <div class="flex flex-col sm:flex-row gap-5 mt-4">
              <Show
                when={qrDataUrl()}
                fallback={
                  <div class="w-[220px] h-[220px] rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">
                    Enter the code below manually
                  </div>
                }
              >
                {(src) => (
                  <img
                    src={src()}
                    alt="QR code for two-factor authentication setup"
                    width={220}
                    height={220}
                    class="rounded-lg bg-white p-2 shrink-0"
                  />
                )}
              </Show>

              <div class="flex-1 min-w-0 space-y-4">
                <div>
                  <Label class="text-xs font-semibold text-muted-foreground">
                    Or enter this code manually
                  </Label>
                  <div class="flex items-center gap-2 mt-1">
                    <code class="flex-1 min-w-0 px-2 py-1.5 rounded bg-muted font-mono text-sm break-all">
                      {pending().secret}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copySecret}
                      aria-label="Copy setup code"
                    >
                      <Show when={copiedSecret()} fallback={<Copy class="w-4 h-4" />}>
                        <Check class="w-4 h-4" />
                      </Show>
                    </Button>
                  </div>
                </div>

                <form onSubmit={handleConfirm} class="space-y-2">
                  <Label
                    for="mfa-confirm"
                    class="block text-xs font-semibold text-muted-foreground"
                  >
                    Then enter the 6-digit code it shows
                  </Label>
                  <TextFieldRoot>
                    <TextField
                      id="mfa-confirm"
                      value={code()}
                      onInput={(e) => setCode(e.currentTarget.value)}
                      placeholder="123456"
                      inputmode="numeric"
                      autocomplete="one-time-code"
                      maxlength={6}
                      class="tracking-[0.3em] text-center"
                    />
                  </TextFieldRoot>

                  <div class="flex gap-2 pt-1">
                    <Button type="submit" disabled={confirmMutation.isPending}>
                      {confirmMutation.isPending ? "Verifying…" : "Turn on"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEnrollment(null);
                        setCode("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Current state. */}
      <Show when={!enrollment()}>
        <Show
          when={status()?.enabled}
          fallback={
            <div class="loci-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <ShieldOff class="w-5 h-5 text-muted-foreground shrink-0" />
                <div class="min-w-0">
                  <p class="font-medium text-foreground">Two-factor authentication is off</p>
                  <p class="text-sm text-muted-foreground">
                    Your password is the only thing protecting this account.
                  </p>
                </div>
              </div>
              <Button type="button" onClick={handleBegin} disabled={beginMutation.isPending}>
                {beginMutation.isPending ? "Starting…" : "Set up"}
              </Button>
            </div>
          }
        >
          <div class="loci-card p-4 sm:p-5 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <ShieldCheck class="w-5 h-5 text-primary shrink-0" />
                <div class="min-w-0">
                  <p class="font-medium text-foreground">Two-factor authentication is on</p>
                  <p class="text-sm text-muted-foreground">
                    <Show
                      when={status()?.enrolledAt}
                      fallback={<>You'll be asked for a code when you sign in.</>}
                    >
                      {(at) => <>Since {at().toLocaleDateString()}.</>}
                    </Show>{" "}
                    {status()?.recoveryCodesRemaining ?? 0} recovery{" "}
                    {status()?.recoveryCodesRemaining === 1 ? "code" : "codes"} left.
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  class="gap-2"
                  onClick={() => setShowRegenerate((v) => !v)}
                >
                  <RefreshCw class="w-4 h-4" />
                  New recovery codes
                </Button>
                <Show when={!status()?.requiredByPolicy}>
                  <Button type="button" variant="ghost" onClick={() => setShowDisable((v) => !v)}>
                    Turn off
                  </Button>
                </Show>
              </div>
            </div>

            {/* Explain the missing "Turn off" button rather than just hiding it. */}
            <Show when={status()?.requiredByPolicy}>
              <p class="text-sm text-muted-foreground border-l-2 border-border pl-3">
                Your account role requires two-factor authentication, so it can't be turned off.
              </p>
            </Show>

            <Show when={(status()?.recoveryCodesRemaining ?? 0) <= LOW_RECOVERY_CODES}>
              <p class="text-sm text-foreground border-l-2 border-primary pl-3">
                You're running low on recovery codes. Generate a new set while you still have access
                to your app — without them, a lost phone means a lost account.
              </p>
            </Show>

            <Show when={showRegenerate()}>
              <form onSubmit={handleRegenerate} class="space-y-2 pt-1">
                <Label
                  for="mfa-regenerate"
                  class="block text-xs font-semibold text-muted-foreground"
                >
                  Enter a code from your app to confirm
                </Label>
                <div class="flex flex-wrap gap-2">
                  <TextFieldRoot class="flex-1 min-w-[10rem]">
                    <TextField
                      id="mfa-regenerate"
                      value={regenerateCode()}
                      onInput={(e) => setRegenerateCode(e.currentTarget.value)}
                      placeholder="123456"
                      inputmode="numeric"
                      autocomplete="one-time-code"
                      maxlength={6}
                    />
                  </TextFieldRoot>
                  <Button type="submit" disabled={regenerateMutation.isPending}>
                    {regenerateMutation.isPending ? "Working…" : "Generate"}
                  </Button>
                </div>
                <p class="text-xs text-muted-foreground">
                  This replaces every existing code. The old ones stop working immediately.
                </p>
              </form>
            </Show>

            <Show when={showDisable()}>
              <form onSubmit={handleDisable} class="space-y-2 pt-1">
                <Label for="mfa-disable" class="block text-xs font-semibold text-muted-foreground">
                  Enter a code from your app, or a recovery code
                </Label>
                <div class="flex flex-wrap gap-2">
                  <TextFieldRoot class="flex-1 min-w-[10rem]">
                    <TextField
                      id="mfa-disable"
                      value={disableCode()}
                      onInput={(e) => setDisableCode(e.currentTarget.value)}
                      placeholder="123456"
                      autocomplete="one-time-code"
                      maxlength={20}
                    />
                  </TextFieldRoot>
                  <Button type="submit" variant="destructive" disabled={disableMutation.isPending}>
                    {disableMutation.isPending ? "Working…" : "Turn off"}
                  </Button>
                </div>
              </form>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
