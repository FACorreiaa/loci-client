import { useQuery } from "@tanstack/solid-query";

/**
 * `useQuery`, but it never runs during server-side rendering.
 *
 * This app fetches everything client-side — no query is prefetched or
 * dehydrated on the server, which you can confirm by watching the API log
 * during an SSR request: it receives nothing. A query that never fetches also
 * never resolves its underlying resource, so any `<Suspense>` reading its
 * `.data` waits forever. Since `app.tsx` wraps the whole router in one
 * `<Suspense>`, a single such query stalls the entire render.
 *
 * On the client that is invisible. During SSR it is fatal: the response never
 * ends, and on Cloudflare the Workers runtime kills the request with
 * "your Worker's code had hung and would never generate a response". That is
 * what made `/pricing`, `/discover`, `/trips` and `/chat` dead routes in a
 * production build while `/about` (which mounts no query) was fine.
 *
 * So on the server we skip the query entirely and hand back a stable
 * "still loading" snapshot — the same state the client shows for the instant
 * before its first fetch resolves, which also keeps the two markups consistent.
 *
 * If you ever want real SSR data, the fix is to prefetch into the QueryClient
 * and dehydrate it, not to remove this wrapper.
 */

/**
 * Are we rendering on the server?
 *
 * Deliberately a runtime check rather than solid-js/web's `isServer`. That
 * constant is resolved per bundle by export conditions, and under the Cloudflare
 * Workers preset the *client* bundle also resolved it to `true` — so every query
 * took the server branch in the browser and the whole app rendered with no data
 * (a signed-in /trips showed "0 ROUTES" with three trips saved). `window` cannot
 * be got wrong: it is absent exactly when there is no DOM.
 */
const renderingOnServer = () => typeof window === "undefined";

export const useAppQuery: typeof useQuery = ((...args: unknown[]) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyUseQuery = useQuery as any;

  if (!renderingOnServer()) return anyUseQuery(...args);

  // On the server, run a real query that resolves immediately to `null`.
  // Going through useQuery (rather than handing back a hand-rolled object)
  // means call sites still get a genuine TanStack result with all of its
  // reactivity wiring intact — only the fetch is skipped. The resource
  // resolves, so Suspense closes and the response can finish.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optionsFn = args[0] as () => Record<string, any>;
  return anyUseQuery(
    () => {
      const options = optionsFn();
      return {
        ...options,
        // A DIFFERENT key from the real one. This matters more than it looks:
        // the server's `null` result is hydrated into the client's cache, and
        // the QueryClient's global staleTime is five minutes, so under the real
        // key the browser considered that null "fresh" and refetchOnMount never
        // fired. Every page then rendered with no data, no loading state and no
        // error — a signed-in /trips reported "0 ROUTES" with three trips saved.
        // Namespacing the key leaves the real one untouched and unpopulated, so
        // the client fetches normally on mount.
        queryKey: [...(options.queryKey ?? []), "__ssr_placeholder__"],
        // `null`, not `undefined`: TanStack treats an undefined resolution as an
        // invalid result and throws `data is undefined`, which surfaced as a
        // console error for every query on every SSR render.
        queryFn: async () => null,
        enabled: true,
        retry: false,
        // Belt and braces: never let this placeholder linger or look fresh.
        staleTime: 0,
        gcTime: 0,
      };
    },
    ...args.slice(1),
  );
}) as typeof useQuery;

/**
 * Kept as a named alias for queries that only make sense once authenticated.
 * Same behaviour — the distinction is documentation for the reader.
 */
export const useAuthedQuery = useAppQuery;
