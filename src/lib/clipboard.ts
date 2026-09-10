/**
 * Copy text to the clipboard, reporting success rather than throwing.
 *
 * `navigator.clipboard` exists only in secure contexts (https, localhost), and
 * a dev build served over plain http on a LAN address has no such object — so
 * a bare `writeText` call there is a TypeError, not a failed copy. The
 * fallback selects the text in an off-screen textarea and asks the browser to
 * copy the selection, which is what every browser did before the async API.
 *
 * Returns false when neither route worked, so the caller can show the text
 * for manual copying instead of pretending.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied, document not focused, … — fall through.
    }
  }

  return copyViaSelection(text);
}

function copyViaSelection(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  // Keep it out of the layout and out of the tab order, but not display:none:
  // a hidden element cannot hold a selection.
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.tabIndex = -1;
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";
  document.body.appendChild(area);
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    return typeof document.execCommand === "function" && document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
