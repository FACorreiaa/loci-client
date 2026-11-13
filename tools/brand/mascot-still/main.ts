// Renders the rest pose with the app's own scene (BRD-001), so the still the
// page paints first is the frame the canvas will draw, and sends that frame
// back to tools/brand/mascot-still.mjs. Not part of the app build.
import "~/styles/themes.css";
import { mountModel } from "~/lib/mascot3d/scene";

const host = document.getElementById("host")!;
const status = (s: string) => {
  document.title = s;
  document.getElementById("status")!.textContent = s;
};

mountModel({
  host,
  url: "/mascot.glb",
  // Fired in the same task as the render, so the drawing buffer still holds
  // the frame and can be read without preserveDrawingBuffer.
  onFirstFrame: () => {
    const png = host.querySelector("canvas")!.toDataURL("image/png");
    void fetch("/__mascot-still", { method: "POST", body: png })
      .then((r) => status(r.ok ? "saved" : `upload failed ${r.status}`))
      .catch((err: unknown) => status(`upload failed ${String(err)}`));
  },
  onLost: () => status("context lost"),
}).catch((err: unknown) => status(`error: ${String(err)}`));
