// Query Provider Component for @tanstack/solid-query
import { JSX, onMount, onCleanup, untrack } from "solid-js";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { SolidQueryDevtools } from "@tanstack/solid-query-devtools";
import { queryClient, performanceUtils, offlineUtils } from "@/lib/query-client";

interface QueryProviderProps {
  children: JSX.Element;
  client?: QueryClient;
}

export const QueryProvider = (props: QueryProviderProps) => {
  // One client for the life of the provider.
  const client = untrack(() => props.client) || queryClient;

  onMount(() => {
    // Setup performance monitoring in development
    if (import.meta.env.DEV) {
      performanceUtils.logSlowQueries(2000); // Log queries taking longer than 2s
    }

    // Setup offline support
    const cleanupOfflineSupport = offlineUtils.setupOfflineSupport();

    // Cleanup function
    onCleanup(() => {
      cleanupOfflineSupport();
    });
  });

  return (
    <QueryClientProvider client={client}>
      {props.children}

      {/* Show devtools only in development */}
      {import.meta.env.DEV && (
        <SolidQueryDevtools
          initialIsOpen={false}
          // position="bottom-right"
          // toggleButtonProps={{
          //   style: {
          //     position: 'fixed',
          //     bottom: '20px',
          //     right: '20px',
          //     'z-index': 99999,
          //     'background-color': '#1f2937',
          //     color: 'white',
          //     border: 'none',
          //     'border-radius': '6px',
          //     padding: '8px 12px',
          //     'font-size': '12px',
          //     cursor: 'pointer',
          //     'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          //   }
          // }}
        />
      )}
    </QueryClientProvider>
  );
};

export default QueryProvider;
