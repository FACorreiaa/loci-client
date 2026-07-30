import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Download, ShieldAlert, Trash2 } from "lucide-solid";
import { exportUserData, deleteAccount } from "~/lib/api/user";
import { useAuth } from "~/contexts/AuthContext";
import { Button } from "~/ui/button";

export default function AccountData() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [exporting, setExporting] = createSignal(false);
  const [confirming, setConfirming] = createSignal(false);
  const [confirmText, setConfirmText] = createSignal("");
  const [deleting, setDeleting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const doExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportUserData();
    } catch {
      setError("Couldn't export your data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const doDelete = async () => {
    if (confirmText() !== "DELETE") return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount("DELETE");
      await logout();
      navigate("/");
    } catch {
      setError("Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <section class="rounded-xl border border-border bg-card p-6 sm:p-8">
      <div class="flex items-start gap-4">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <ShieldAlert class="h-5 w-5" />
        </span>
        <div>
          <p class="font-coord text-[10px] uppercase tracking-[0.18em] text-accent">
            Your data · your rights
          </p>
          <h3 class="mt-1 text-2xl">Data &amp; account</h3>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Download a copy of your data, or permanently delete your account and everything tied to
            it.
          </p>
        </div>
      </div>

      <Show when={error()}>
        <p class="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error()}
        </p>
      </Show>

      {/* Export */}
      <div class="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background p-4">
        <div>
          <span class="block text-sm font-semibold">Export my data</span>
          <span class="mt-1 block text-xs leading-5 text-muted-foreground">
            A machine-readable JSON copy of your profile.
          </span>
        </div>
        <Button variant="outline" class="gap-2" disabled={exporting()} onClick={doExport}>
          <Download class="h-4 w-4" />
          {exporting() ? "Preparing…" : "Download"}
        </Button>
      </div>

      {/* Danger zone */}
      <div class="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span class="block text-sm font-semibold text-destructive">Delete my account</span>
            <span class="mt-1 block text-xs leading-5 text-muted-foreground">
              Permanent and irreversible. All trips, profiles, and saved items are removed.
            </span>
          </div>
          <Show when={!confirming()}>
            <Button
              variant="outline"
              class="gap-2 border-destructive/50 text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 class="h-4 w-4" />
              Delete account
            </Button>
          </Show>
        </div>

        <Show when={confirming()}>
          <div class="mt-4 border-t border-destructive/30 pt-4">
            <label class="block text-xs text-muted-foreground">
              Type <span class="font-semibold text-destructive">DELETE</span> to confirm
            </label>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={confirmText()}
                onInput={(e) => setConfirmText(e.currentTarget.value)}
                placeholder="DELETE"
                class="w-40 rounded-md border border-destructive/50 bg-background px-3 py-1.5 text-sm"
              />
              <Button
                class="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={confirmText() !== "DELETE" || deleting()}
                onClick={doDelete}
              >
                {deleting() ? "Deleting…" : "Permanently delete"}
              </Button>
              <button
                type="button"
                class="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Show>
      </div>
    </section>
  );
}
