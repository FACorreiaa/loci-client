import { For, startTransition, Suspense } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/ui/tabs";
import { Skeleton } from "~/ui/skeleton";
import { BrandIcon } from "~/components/brand/agents";
import { CLIENT_KINDS, type ClientKind, type useCreateApiKey } from "~/lib/api/api-keys";
import { AgentPanel } from "./AgentPanel";
import { SectionCard } from "./SectionCard";
import { agentFromParam } from "./state";
import type { Notify } from "./ConnectionsPage";

interface ConnectAgentCardProps {
  create: ReturnType<typeof useCreateApiKey>;
  onNotification: Notify;
}

function PanelSkeleton() {
  return (
    <div class="space-y-3" aria-busy="true">
      <Skeleton class="h-4 w-48" />
      <Skeleton class="h-28 w-full" />
      <Skeleton class="h-10 w-full" />
    </div>
  );
}

/**
 * Pick an agent, see exactly what to paste, make a key for it.
 *
 * The selected agent lives in `?agent=` so a support answer can link straight
 * to "Settings → Agent connections → Codex". Changing it is wrapped in a
 * transition: the panel's setup query rekeys on the new agent, and without
 * the transition Solid would show the Suspense fallback for the whole panel on
 * every switch instead of keeping the old one until the new one is ready.
 */
export function ConnectAgentCard(props: ConnectAgentCardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const agent = (): ClientKind => agentFromParam(searchParams.agent);

  const select = (value: string) => {
    void startTransition(() => {
      // replace: switching agents should not fill the back button.
      setSearchParams({ agent: value }, { replace: true });
    });
  };

  return (
    <SectionCard
      title="Connect an agent"
      description="Pick the one you use. The setup is written for it, and the key you make here is named after it so you can tell them apart later."
    >
      <Tabs value={agent()} onChange={select}>
        <TabsList class="h-auto flex-wrap gap-1" aria-label="Agent">
          <For each={CLIENT_KINDS}>
            {(kind) => (
              <TabsTrigger
                value={kind.value}
                class="h-8 w-auto gap-2 data-[selected]:bg-background data-[selected]:shadow"
              >
                <BrandIcon name={kind.value} class="h-4 w-4 shrink-0" />
                {kind.label}
              </TabsTrigger>
            )}
          </For>
        </TabsList>
        <For each={CLIENT_KINDS}>
          {(kind) => (
            <TabsContent value={kind.value} class="mt-4">
              <Suspense fallback={<PanelSkeleton />}>
                <AgentPanel
                  kind={kind.value}
                  label={kind.label}
                  create={props.create}
                  onNotification={props.onNotification}
                />
              </Suspense>
            </TabsContent>
          )}
        </For>
      </Tabs>
    </SectionCard>
  );
}
