import { createSignal, onCleanup, Show } from "solid-js";
import { AlertTriangle, Check, Copy, Send, Unlink, X } from "lucide-solid";
import { Button } from "~/ui/button";
import {
  useCreateMessagingLinkCode,
  useMessagingLink,
  useUnlinkMessaging,
  type MessagingLinkCode,
} from "~/lib/api/messaging";

interface TelegramLinkProps {
  onNotification: (message: string, type: "success" | "error") => void;
}

function formatDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function minutesUntil(ms?: number): number {
  if (!ms) return 0;
  return Math.max(0, Math.ceil((ms - Date.now()) / 60_000));
}

/**
 * Link a Telegram chat to this account.
 *
 * The handshake cannot be shortcut from here: the server issues a short code,
 * the person sends it to the bot, and the bot reports which chat it came from.
 * That message is the proof somebody controls the chat, so this card's job is
 * to make sending it easy and then wait.
 */
export default function TelegramLink(props: TelegramLinkProps) {
  const linkQuery = useMessagingLink();
  const createCode = useCreateMessagingLinkCode();
  const unlink = useUnlinkMessaging();

  const [code, setCode] = createSignal<MessagingLinkCode | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [confirmUnlink, setConfirmUnlink] = createSignal(false);

  const link = () => linkQuery.data?.link ?? null;
  // No bot handle means the deployment has no bot token. A code with nowhere to
  // send it is worse than no code, so the card says so instead.
  const botHandle = () => linkQuery.data?.botHandle ?? "";

  // While a code is outstanding the link appears only when the bot reports the
  // chat, which this session cannot observe any other way.
  let poll: ReturnType<typeof setInterval> | undefined;
  const startPolling = () => {
    if (poll) return;
    poll = setInterval(() => {
      if (link()) {
        stopPolling();
        setCode(null);
        props.onNotification("Telegram linked.", "success");
        return;
      }
      void linkQuery.refetch();
    }, 3000);
  };
  const stopPolling = () => {
    if (poll) clearInterval(poll);
    poll = undefined;
  };
  onCleanup(stopPolling);

  const handleCreateCode = async () => {
    try {
      const result = await createCode.mutateAsync();
      setCode(result);
      startPolling();
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't create a link code.",
        "error",
      );
    }
  };

  const copyCode = async () => {
    const value = code()?.code;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(`/start ${value}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      props.onNotification("Couldn't copy — select the code and copy it manually.", "error");
    }
  };

  const handleUnlink = async () => {
    try {
      await unlink.mutateAsync();
      setConfirmUnlink(false);
      setCode(null);
      stopPolling();
      props.onNotification("Telegram unlinked.", "success");
    } catch (err) {
      props.onNotification(err instanceof Error ? err.message : "Couldn't unlink.", "error");
    }
  };

  return (
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
          <Send class="w-5 h-5 text-primary" />
          Telegram
        </h3>
        <p class="text-sm text-muted-foreground mt-1">
          Ask Loci for a plan from a chat, and get it back there. Linking proves the chat is yours
          by having you message the bot — nothing here can link it on your behalf.
        </p>
      </div>

      <Show
        when={botHandle() || linkQuery.isLoading}
        fallback={
          <div class="rounded-lg border border-border bg-muted/40 p-4">
            <div class="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertTriangle class="w-4 h-4" />
              No bot on this deployment
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              This server has no Telegram bot configured, so there is nowhere to send a link code.
            </p>
          </div>
        }
      >
        <Show
          when={link()}
          fallback={
            <Show
              when={code()}
              fallback={
                <Button
                  class="gap-2"
                  disabled={createCode.isPending || linkQuery.isLoading}
                  onClick={handleCreateCode}
                >
                  <Send class="w-4 h-4" />
                  {createCode.isPending ? "Creating…" : "Link Telegram"}
                </Button>
              }
            >
              {(issued) => (
                <div class="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                  <p class="text-sm text-foreground">
                    Send this to{" "}
                    <span class="font-medium">
                      {issued().botHandle || botHandle() || "the bot"}
                    </span>
                    . The link appears here as soon as the bot sees it.
                  </p>
                  <div class="flex items-center gap-2 rounded-md border border-border bg-background p-3">
                    <code class="flex-1 font-mono text-sm text-foreground break-all">
                      /start {issued().code}
                    </code>
                    <Button variant="outline" size="sm" class="gap-1 shrink-0" onClick={copyCode}>
                      <Show when={copied()} fallback={<Copy class="w-4 h-4" />}>
                        <Check class="w-4 h-4 text-accent" />
                      </Show>
                      {copied() ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <Show when={issued().deepLink}>
                      <Button
                        as="a"
                        href={issued().deepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        class="gap-2"
                      >
                        <Send class="w-4 h-4" />
                        Open Telegram
                      </Button>
                    </Show>
                    <span class="text-xs text-muted-foreground">
                      Expires in {minutesUntil(issued().expiresAt)} min · waiting for the bot…
                    </span>
                  </div>
                </div>
              )}
            </Show>
          }
        >
          {(linked) => (
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <div class="text-sm">
                <div class="font-medium text-foreground">
                  {linked().displayName || "Linked chat"}
                </div>
                <div class="text-xs text-muted-foreground mt-0.5">
                  Linked {formatDate(linked().linkedAt)} · last seen{" "}
                  {linked().lastSeenAt ? formatDate(linked().lastSeenAt) : "never"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive hover:text-destructive gap-1"
                onClick={() => setConfirmUnlink(true)}
              >
                <Unlink class="w-4 h-4" />
                Unlink
              </Button>
            </div>
          )}
        </Show>
      </Show>

      <Show when={confirmUnlink()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div class="flex items-start justify-between">
              <h3 class="text-lg font-semibold text-foreground">Unlink Telegram?</h3>
              <button
                onClick={() => setConfirmUnlink(false)}
                class="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
            <p class="text-sm text-muted-foreground mt-2">
              The bot stops answering in that chat. You can link it again with a new code.
            </p>
            <div class="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmUnlink(false)}>
                Keep it
              </Button>
              <Button variant="destructive" disabled={unlink.isPending} onClick={handleUnlink}>
                {unlink.isPending ? "Unlinking…" : "Unlink"}
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
