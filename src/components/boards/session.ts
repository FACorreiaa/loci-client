import { useAuth } from "~/contexts/AuthContext";
import { useBoardsViewer } from "~/lib/api/boards";
import { showToast } from "~/lib/toast-store";

/** Who is looking at a board page, and what they may do there. */
export function useBoardsSession() {
  const { user, isAuthenticated } = useAuth();
  const viewerQuery = useBoardsViewer();
  // Guarded read: touching .data while pending suspends the whole route.
  const viewer = () => (viewerQuery.isSuccess ? viewerQuery.data : undefined);
  return {
    signedIn: () => isAuthenticated(),
    myId: () => user()?.id ?? "",
    isAdmin: () => !!viewer()?.isAdmin,
    sanction: () => viewer()?.sanction,
  };
}

export type BoardsSession = ReturnType<typeof useBoardsSession>;

/**
 * Deleting goes through a toast rather than a browser confirm(): one more
 * deliberate tap, and nothing that blocks the page.
 */
export function confirmDelete(what: string, run: () => void) {
  showToast({
    id: "boards-delete",
    title: `Delete this ${what}? This can't be undone here.`,
    action: { label: "Delete", run },
  });
}
