import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Copy, LogOut, MessageSquare, Pencil, Users } from "lucide-solid";
import { Button } from "~/ui/button";
import UserAvatar from "~/components/social/UserAvatar";
import {
  useCreateTripInvite,
  useRemoveTripMember,
  useSetCoPlannersMayApply,
  type TripInvite,
} from "~/lib/api/trip-members";
import type { Trip } from "~/lib/api/trips";
import { copyInviteLink, shareInvite, smsInviteHref, type ShareableInvite } from "~/lib/invite";
import { capture } from "~/lib/analytics";

const hasShareSheet = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

const whatsappHref = (inv: ShareableInvite) =>
  `https://wa.me/?text=${encodeURIComponent(`${inv.shareText} ${inv.url}`)}`;

/**
 * Who is on the trip, and the way to bring more people onto it.
 *
 * The owner gets Plan together: it makes (or reuses) the trip's invite link
 * and opens the share sheet. Without one, the link is copied or sent by text
 * or WhatsApp from the person's own phone. Once someone has joined, the owner
 * also decides whether co-planners may apply suggestions. A member gets Leave
 * trip, and a co-planner the switch into suggesting changes.
 */
export default function TripMembersBar(props: {
  trip: Trip;
  currentUserId?: string;
  /** Set for a co-planner: whether the stops are in suggest mode. */
  suggesting?: boolean;
  onToggleSuggest?: () => void;
}) {
  const navigate = useNavigate();
  const createInvite = useCreateTripInvite();
  const remove = useRemoveTripMember();
  const setMayApply = useSetCoPlannersMayApply();
  const [invite, setInvite] = createSignal<TripInvite>();
  const [copied, setCopied] = createSignal(false);
  const [confirmLeave, setConfirmLeave] = createSignal(false);

  const isOwner = () => !props.trip.owner;
  const members = () => props.trip.members ?? [];
  const shareable = (inv: TripInvite): ShareableInvite => ({
    url: inv.url,
    shareText: `Plan ${props.trip.title} with me on Loci`,
  });

  const planTogether = () =>
    createInvite.mutate(
      { tripId: props.trip.id },
      {
        onSuccess: async (inv) => {
          setInvite(inv);
          const result = await shareInvite(shareable(inv));
          if (result === "shared") capture("invite_shared", { via: "sheet", kind: "trip" });
        },
      },
    );

  const copy = async (inv: TripInvite) => {
    if (await copyInviteLink(shareable(inv))) {
      capture("invite_shared", { via: "copy", kind: "trip" });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  const leave = () => {
    if (!props.currentUserId) return;
    remove.mutate(
      { tripId: props.trip.id, userId: props.currentUserId },
      { onSuccess: () => navigate("/trips") },
    );
  };

  return (
    <section class="loci-card no-print mb-6 p-4" aria-labelledby="trip-members-title">
      <div class="flex flex-wrap items-center gap-3">
        <h2 id="trip-members-title" class="sr-only">
          Who's going
        </h2>
        <Show
          when={members().length > 0}
          fallback={
            <span class="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Users class="h-4 w-4" aria-hidden="true" />
              Just you so far
            </span>
          }
        >
          <ul class="flex -space-x-2">
            <For each={members().slice(0, 8)}>
              {(m) => (
                <li title={`${m.user.displayName}${m.role === "owner" ? " (planner)" : ""}`}>
                  <UserAvatar user={m.user} size="sm" class="ring-2 ring-card" />
                </li>
              )}
            </For>
          </ul>
          <span class="text-sm text-muted-foreground">{members().length} going</span>
        </Show>

        <div class="ml-auto flex flex-wrap gap-2">
          <Show when={isOwner()}>
            <Button
              size="sm"
              class="gap-1.5"
              disabled={createInvite.isPending}
              onClick={planTogether}
            >
              <Users class="h-3.5 w-3.5" aria-hidden="true" />
              {createInvite.isPending ? "Making link…" : "Plan together"}
            </Button>
          </Show>
          <Show when={props.suggesting !== undefined}>
            <Button
              size="sm"
              variant={props.suggesting ? "default" : "outline"}
              class="gap-1.5"
              aria-pressed={props.suggesting}
              onClick={() => props.onToggleSuggest?.()}
            >
              <Pencil class="h-3.5 w-3.5" aria-hidden="true" />
              {props.suggesting ? "Done suggesting" : "Suggest changes"}
            </Button>
          </Show>
          <Show when={!isOwner() && props.currentUserId}>
            <Show
              when={confirmLeave()}
              fallback={
                <Button
                  size="sm"
                  variant="ghost"
                  class="gap-1.5"
                  onClick={() => setConfirmLeave(true)}
                >
                  <LogOut class="h-3.5 w-3.5" aria-hidden="true" />
                  Leave trip
                </Button>
              }
            >
              <Button size="sm" variant="destructive" disabled={remove.isPending} onClick={leave}>
                {remove.isPending ? "Leaving…" : "Leave this trip"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmLeave(false)}>
                Stay
              </Button>
            </Show>
          </Show>
        </div>
      </div>

      <Show when={createInvite.isError}>
        <p class="mt-3 text-sm text-destructive" role="alert">
          Couldn't make an invite link. Try again.
        </p>
      </Show>

      {/* After the first tap the link stays here, for desktops without a
          share sheet and for sending it again another way. */}
      <Show when={invite()}>
        {(inv) => (
          <div class="mt-4 space-y-3">
            <p class="text-sm text-muted-foreground">
              Anyone who opens this link joins as a co-planner: they see the whole trip and can
              suggest changes. It works for 14 days.
            </p>
            <input
              readOnly
              value={inv().url}
              aria-label="Trip invite link"
              class="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div class="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" class="gap-1.5" onClick={() => void copy(inv())}>
                <Copy class="h-3.5 w-3.5" aria-hidden="true" />
                {copied() ? "Copied" : "Copy link"}
              </Button>
              <Show when={!hasShareSheet()}>
                <Button
                  as="a"
                  href={smsInviteHref(shareable(inv()))}
                  size="sm"
                  variant="outline"
                  class="gap-1.5"
                  onClick={() => capture("invite_shared", { via: "sms", kind: "trip" })}
                >
                  <MessageSquare class="h-3.5 w-3.5" aria-hidden="true" />
                  Text message
                </Button>
                <Button
                  as="a"
                  href={whatsappHref(shareable(inv()))}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  variant="outline"
                  onClick={() => capture("invite_shared", { via: "whatsapp", kind: "trip" })}
                >
                  WhatsApp
                </Button>
              </Show>
            </div>
          </div>
        )}
      </Show>
      <Show when={isOwner() && members().length > 0}>
        <label class="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            class="mt-0.5"
            checked={!!props.trip.coPlannersMayApply}
            disabled={setMayApply.isPending}
            onChange={(e) =>
              setMayApply.mutate({ tripId: props.trip.id, may: e.currentTarget.checked })
            }
          />
          <span>
            Co-planners can apply suggestions
            <span class="block text-xs text-muted-foreground">
              Otherwise only you change the trip.
            </span>
          </span>
        </label>
        <Show when={setMayApply.isError}>
          <p class="mt-1 text-xs text-destructive">Couldn't change that setting. Try again.</p>
        </Show>
      </Show>
    </section>
  );
}
