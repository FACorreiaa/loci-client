import { createSignal, Show } from "solid-js";
import { Lock } from "lucide-solid";
import { Button } from "~/ui/button";
import { TextField, TextFieldRoot } from "~/ui/textfield";
import { Label } from "~/ui/label";
import { useUpdatePasswordMutation } from "~/lib/api/auth-connect";

interface ChangePasswordProps {
  onNotification: (message: string, type: "success" | "error") => void;
}

/** What the server enforces, restated so the form can refuse before a round trip. */
const MIN_LENGTH = 8;

/**
 * Change the account password.
 *
 * `useUpdatePasswordMutation` has existed and been exported with no caller, so
 * the only way to change a password was the forgot-password mail — which asks
 * somebody who knows their password to prove they own their inbox instead.
 */
export default function ChangePassword(props: ChangePasswordProps) {
  const updatePassword = useUpdatePasswordMutation();

  const [oldPassword, setOldPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  // Field-level, because a card that reports "invalid" without saying which
  // field is a guessing game.
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!oldPassword()) next.oldPassword = "Enter your current password.";
    if (newPassword().length < MIN_LENGTH) {
      next.newPassword = `At least ${MIN_LENGTH} characters.`;
    }
    if (newPassword() && newPassword() === oldPassword()) {
      next.newPassword = "That's the password you already have.";
    }
    if (confirm() !== newPassword()) next.confirm = "These don't match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const clear = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirm("");
    setErrors({});
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      const result = await updatePassword.mutateAsync({
        oldPassword: oldPassword(),
        newPassword: newPassword(),
      });
      if (!result.success) {
        // The server's own message is more specific than anything invented
        // here — most often that the current password is wrong.
        setErrors({ oldPassword: result.message || "That didn't work." });
        return;
      }
      clear();
      props.onNotification("Password changed.", "success");
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't change your password.",
        "error",
      );
    }
  };

  const fieldError = (name: string) => errors()[name];

  return (
    <form onSubmit={handleSubmit} class="space-y-4">
      <div>
        <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
          <Lock class="w-5 h-5 text-primary" />
          Password
        </h3>
        <p class="text-sm text-muted-foreground mt-1">
          Changing it here does not sign out your other sessions.
        </p>
      </div>

      <div>
        <Label for="old-password" class="text-sm">
          Current password
        </Label>
        <TextFieldRoot class="mt-1">
          <TextField
            id="old-password"
            type="password"
            autocomplete="current-password"
            value={oldPassword()}
            onInput={(e) => setOldPassword(e.currentTarget.value)}
          />
        </TextFieldRoot>
        <Show when={fieldError("oldPassword")}>
          <p class="text-xs text-destructive mt-1">{fieldError("oldPassword")}</p>
        </Show>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label for="new-password" class="text-sm">
            New password
          </Label>
          <TextFieldRoot class="mt-1">
            <TextField
              id="new-password"
              type="password"
              autocomplete="new-password"
              value={newPassword()}
              onInput={(e) => setNewPassword(e.currentTarget.value)}
            />
          </TextFieldRoot>
          <Show
            when={fieldError("newPassword")}
            fallback={
              <p class="text-xs text-muted-foreground mt-1">{MIN_LENGTH} characters or more.</p>
            }
          >
            <p class="text-xs text-destructive mt-1">{fieldError("newPassword")}</p>
          </Show>
        </div>

        <div>
          <Label for="confirm-password" class="text-sm">
            Repeat it
          </Label>
          <TextFieldRoot class="mt-1">
            <TextField
              id="confirm-password"
              type="password"
              autocomplete="new-password"
              value={confirm()}
              onInput={(e) => setConfirm(e.currentTarget.value)}
            />
          </TextFieldRoot>
          <Show when={fieldError("confirm")}>
            <p class="text-xs text-destructive mt-1">{fieldError("confirm")}</p>
          </Show>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Show when={oldPassword() || newPassword() || confirm()}>
          <Button type="button" variant="outline" onClick={clear}>
            Cancel
          </Button>
        </Show>
        <Button type="submit" disabled={updatePassword.isPending}>
          {updatePassword.isPending ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
