import { createEffect, createSignal, on, Show } from "solid-js";
import { Send, Unlink } from "lucide-solid";
import { Badge } from "~/ui/badge";
import { Button } from "~/ui/button";
import { CodeBlock } from "~/ui/code-block";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/ui/dialog";
import {
  TELEGRAM,
  useCreateMessagingLinkCode,
  useMessagingLink,
  useUnlinkMessaging,
  type MessagingLinkCode,
} from "~/lib/api/messaging";
import { SectionCard } from "./SectionCard";
import { formatDate, minutesUntil, telegramState } from "./state";
import type { Notify } from "./ConnectionsPage";

interface TelegramCardProps {
  onNotification: Notify;
}

/**
 * Link a Telegram chat to this account.
 *
 * The handshake cannot be shortcut from here: the server issues a short code,
 * the person sends it to the bot, and the bot reports which chat it came
 * from. That message is the proof somebody controls the chat, so this card's
 * job is to make sending it easy and then wait — polling only while a code is
 * outstanding, since that is the only time the answer can change.
 */
export function TelegramCard(props: TelegramCardProps) {
  const [issued, setIssued] = createSignal<MessagingLinkCode | null>(null);
  const linkQuery = useMessagingLink(TELEGRAM, {
    refetchInterval: () => (issued() ? 3_000 : false),
  });
  const createCode = useCreateMessagingLinkCode();
  const unlink = useUnlinkMessaging();

  const data = () => (linkQuery.isSuccess ? linkQuery.data : undefined);
  const link = () => data()?.link ?? null;
  // No bot handle means the deployment has no bot token. A code with nowhere
  // to send it is worse than no code, so the card says so instead.
  const enabled = () => Boolean(data()?.botHandle);
  const botHandle = () => issued()?.botHandle || data()?.botHandle || "the bot";

  const state = () => telegramState(link(), issued(), enabled());

  const [confirmUnlink, setConfirmUnlink] = createSignal(false);

  // The link appearing while a code is out is the bot reporting the chat.
  createEffect(
    on(link, (linked, previous) => {
      if (linked && !previous && issued()) {
        setIssued(null);
        props.onNotification("Telegram connected.", "success");
      }
    }),
  );

  const handleCreateCode = async () => {
    try {
      setIssued(await createCode.mutateAsync());
    } catch (err) {
      props.onNotification(
        err instanceof Error ? err.message : "Couldn't get a link code.",
        "error",
      );
    }
  };

  const handleUnlink = async () => {
    try {
      await unlink.mutateAsync();
      setConfirmUnlink(false);
      setIssued(null);
      props.onNotification("Telegram disconnected.", "success");
    } catch (err) {
      props.onNotification(err instanceof Error ? err.message : "Couldn't disconnect.", "error");
    }
  };

  return (
    <SectionCard
      title="Telegram"
      description="Ask Loci for a plan from a chat and get it back there. Linking proves the chat is yours by having you message the bot — nothing here can link it on your behalf."
      aside={
        <Show when={state() === "linked"}>
          <Badge variant="secondary">Connected</Badge>
        </Show>
      }
    >
      <Show when={!linkQuery.isPending}>
        <Show when={linkQuery.isError}>
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <span class="text-sm text-destructive">Couldn't check your Telegram link.</span>
            <Button variant="outline" size="sm" onClick={() => void linkQuery.refetch()}>
              Retry
            </Button>
          </div>
        </Show>

        <Show when={state() === "disabled" && !linkQuery.isError}>
          <p class="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Telegram is not configured on this server yet.
          </p>
        </Show>

        <Show when={state() === "idle"}>
          <div class="space-y-4">
            <ol class="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Get a link code here. It works for a few minutes.</li>
              <li>
                Send it to <span class="font-medium text-foreground">{botHandle()}</span> — one tap
                with the button, or paste it yourself.
              </li>
              <li>The bot answers in that chat from then on.</li>
            </ol>
            <Button class="gap-2" disabled={createCode.isPending} onClick={handleCreateCode}>
              <Send class="h-4 w-4" aria-hidden="true" />
              {createCode.isPending ? "Getting a code…" : "Get a link code"}
            </Button>
          </div>
        </Show>

        <Show when={state() === "code" ? issued() : null}>
          {(code) => (
            <div class="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              <p class="text-sm text-foreground">
                Send this to <span class="font-medium">{botHandle()}</span>. The link appears here
                as soon as the bot sees it.
              </p>
              <div class="flex flex-wrap items-center gap-3">
                <Show when={code().deepLink}>
                  <Button
                    as="a"
                    href={code().deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="gap-2"
                  >
                    <Send class="h-4 w-4" aria-hidden="true" />
                    Open in Telegram
                  </Button>
                </Show>
                <span class="text-xs text-muted-foreground">
                  Expires in {minutesUntil(code().expiresAt)} min · waiting for the bot…
                </span>
              </div>
              <CodeBlock heading="Or send this code yourself" body={`/start ${code().code}`} />
            </div>
          )}
        </Show>

        <Show when={state() === "linked" ? link() : null}>
          {(linked) => (
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <div class="text-sm">
                <div class="font-medium text-foreground">
                  {linked().displayName || "Linked chat"}
                </div>
                <div class="mt-0.5 text-xs text-muted-foreground">
                  Linked {formatDate(linked().linkedAt)}
                  <Show when={linked().lastSeenAt}>
                    {" "}
                    · last seen {formatDate(linked().lastSeenAt)}
                  </Show>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="gap-1 text-destructive hover:text-destructive"
                onClick={() => setConfirmUnlink(true)}
              >
                <Unlink class="h-4 w-4" aria-hidden="true" />
                Disconnect
              </Button>
            </div>
          )}
        </Show>
      </Show>

      <Dialog open={confirmUnlink()} onOpenChange={setConfirmUnlink}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Telegram?</DialogTitle>
            <DialogDescription>
              The bot stops answering in that chat. You can connect it again with a new code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter class="gap-2">
            <Button variant="outline" onClick={() => setConfirmUnlink(false)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={unlink.isPending} onClick={handleUnlink}>
              {unlink.isPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
