// The app's one global toast list. Built for finished background searches;
// keep it that small — this is not a general notification center.
import { createStore, produce } from "solid-js/store";

export interface Toast {
  id: string;
  title: string;
  action?: { label: string; href?: string; run?: () => void };
  secondary?: { label: string; run: () => void };
}

const MAX = 3;
const [toasts, setToasts] = createStore<Toast[]>([]);
export { toasts };

/** Show a toast. The same id replaces its previous toast; oldest is dropped past MAX. */
export function showToast(t: Toast): void {
  setToasts(
    produce((list) => {
      const i = list.findIndex((x) => x.id === t.id);
      if (i >= 0) list.splice(i, 1);
      list.push(t);
      while (list.length > MAX) list.shift();
    }),
  );
}

export function dismissToast(id: string): void {
  setToasts((list) => list.filter((t) => t.id !== id));
}
