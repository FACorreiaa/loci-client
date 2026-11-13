/**
 * The only module in the app that imports `three` (scripts/brand-guard.sh
 * fails CI otherwise). Everything WebGL lives here so the renderer stays one
 * lazy chunk that the server build never sees.
 *
 *   mountModel — the 3D mascot (BRD-001), driven by ~/lib/mascot-motion.
 *   mountPlane — the older 2.5D scene: the clay render on a plane, tilted
 *                toward the pointer (MascotScene.tsx).
 *
 * Callers own the decision to start (in view, motion allowed, WebGL present);
 * this module owns the GPU and must leave nothing behind on dispose().
 */

import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  MASCOT_MOTION,
  approach,
  blinkScale,
  blinkSeconds,
  blinkWait,
  lookToward,
  sampleTrack,
  type Track,
} from "~/lib/mascot-motion";
import rig from "./mascot-rig.json";

const DEG = Math.PI / 180;
/** A frame longer than this is a stall (tab switch, debugger), not motion. */
const MAX_FRAME_SECONDS = 0.1;
/** Full room light washes the coral out; 0.55 matches Aaru's tuned value. */
const ENVIRONMENT_INTENSITY = 0.55;
const KEY_INTENSITY = 1.6;
const RIM_INTENSITY = 1.4;

export interface MascotHandle {
  /** Run or pause the loop. Paused time is not replayed. */
  setRunning(running: boolean): void;
  /** Pointer in [-1, 1] on both axes, y up. */
  setPointer(x: number, y: number): void;
  dispose(): void;
}

export interface MountModelOptions {
  host: HTMLElement;
  url: string;
  /** Fired once, after the first frame has been drawn. */
  onFirstFrame: () => void;
  /** The WebGL context went away; the caller should show the still again. */
  onLost: () => void;
}

/**
 * Brand colours for the lights, read from the live stylesheet rather than
 * written here: `--lantern` (key) and `--holo` (rim) at their dark-appearance
 * values, which a `.loci-hero` element always has (DESIGN.md).
 */
function brandLightColours(): { key: Color; rim: Color } {
  const probe = document.createElement("div");
  probe.className = "loci-hero";
  probe.style.display = "none";
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const read = (name: string) =>
    new Color().setStyle(`hsl(${style.getPropertyValue(name).trim().split(/\s+/).join(", ")})`);
  const colours = { key: read("--lantern"), rim: read("--holo") };
  probe.remove();
  return colours;
}

function newRenderer(): WebGLRenderer {
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  return renderer;
}

function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) m.dispose();
  });
}

export async function mountModel(opts: MountModelOptions): Promise<MascotHandle> {
  const { host } = opts;
  const renderer = newRenderer();
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;

  const { key, rim } = brandLightColours();
  const keyLight = new DirectionalLight(key, KEY_INTENSITY);
  keyLight.position.set(1.5, 2.5, 3);
  const rimLight = new DirectionalLight(rim, RIM_INTENSITY);
  rimLight.position.set(-2, 1.5, -2);
  scene.add(keyLight, rimLight);

  const cam = rig.camera;
  const camera = new PerspectiveCamera(cam.fovDegrees, 3 / 4, 0.05, 20);
  camera.position.set(cam.target[0], cam.target[1], cam.distance);
  camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);

  let gltfScene: Object3D;
  try {
    gltfScene = (await new GLTFLoader().loadAsync(opts.url)).scene;
  } catch (err) {
    environment.dispose();
    renderer.dispose();
    throw err;
  }
  scene.add(gltfScene);

  const joint = (name: string) => {
    const o = gltfScene.getObjectByName(name);
    if (!o) throw new Error(`mascot model has no ${name} joint`);
    return o;
  };
  const motion = MASCOT_MOTION;
  const lookJoint = joint(motion.lookAt.joint);
  lookJoint.rotation.order = "YXZ";
  const eyes = motion.lookAt.eyes.map((n) => {
    const o = joint(n);
    return { o, rest: o.position.clone() };
  });
  const blinkJoints = motion.blink.joints.map(joint);

  const tracks = motion.states.standing.tracks;
  const jointRest = new Map<Object3D, { y: number }>();
  const jointTracks: { track: Track; o: Object3D }[] = [];
  const materialTracks: { track: Track; mats: MeshStandardMaterial[] }[] = [];
  for (const track of tracks) {
    if (track.joint) {
      const o = joint(track.joint);
      jointRest.set(o, { y: o.position.y });
      jointTracks.push({ track, o });
    } else if (track.material) {
      const mats = new Set<MeshStandardMaterial>();
      gltfScene.traverse((o) => {
        const m = (o as Mesh).material as MeshStandardMaterial | undefined;
        if ((o as Mesh).isMesh && m && m.name === track.material) mats.add(m);
      });
      materialTracks.push({ track, mats: [...mats] });
    }
  }

  // Pose at time t (seconds of running), pointer look, and blink. t = 0 with
  // the look at rest is exactly what tools/brand/mascot-still.mjs captures.
  let look = { yaw: 0, pitch: 0, eyeX: 0, eyeY: 0 };
  let target = lookToward(0, 0);
  let nextBlink = blinkWait(Math.random());
  let blinkAt = -1;

  const pose = (t: number, dt: number) => {
    for (const { track, o } of jointTracks) {
      const v = sampleTrack(track, t);
      const rest = jointRest.get(o)!;
      if (track.property === "translateY") o.position.y = rest.y + v;
    }
    for (const { track, mats } of materialTracks) {
      const v = sampleTrack(track, t);
      for (const m of mats) m.emissiveIntensity = v;
    }

    const tau = motion.lookAt.timeConstantSeconds;
    look = {
      yaw: approach(look.yaw, target.yawDegrees, dt, tau),
      pitch: approach(look.pitch, target.pitchDegrees, dt, tau),
      eyeX: approach(look.eyeX, target.eyeX, dt, tau),
      eyeY: approach(look.eyeY, target.eyeY, dt, tau),
    };
    // Positive pitch looks up, which is a negative turn about +X.
    lookJoint.rotation.set(-look.pitch * DEG, look.yaw * DEG, 0);
    for (const e of eyes) e.o.position.set(e.rest.x + look.eyeX, e.rest.y + look.eyeY, e.rest.z);

    if (blinkAt < 0 && t >= nextBlink) blinkAt = t;
    const scaleY = blinkAt < 0 ? motion.blink.open : blinkScale(t - blinkAt);
    if (blinkAt >= 0 && t - blinkAt >= blinkSeconds()) {
      blinkAt = -1;
      nextBlink = t + blinkWait(Math.random());
    }
    for (const o of blinkJoints) o.scale.y = scaleY;
  };

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(host);
  host.appendChild(renderer.domElement);

  let raf = 0;
  let running = false;
  let first = true;
  let t = 0;
  // Last frame's timestamp; 0 after a pause so paused time is not replayed.
  let last = 0;

  const draw = (dt: number) => {
    pose(t, dt);
    renderer.render(scene, camera);
    if (first) {
      first = false;
      opts.onFirstFrame();
    }
  };
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, MAX_FRAME_SECONDS) : 0;
    last = now;
    t += dt;
    draw(dt);
  };

  const onLost = (e: Event) => {
    e.preventDefault();
    setRunning(false);
    opts.onLost();
  };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  function setRunning(next: boolean) {
    if (next === running) return;
    running = next;
    if (next) {
      last = 0;
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
    }
  }

  // Draw the rest pose now, so the canvas holds a frame even before the
  // caller starts the loop.
  draw(0);

  return {
    setRunning,
    setPointer(x, y) {
      target = lookToward(x, y);
    },
    dispose() {
      setRunning(false);
      sizeObserver.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      disposeTree(gltfScene);
      environment.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    },
  };
}

// --------------------------------------------------------------------------- 2.5D plane

/** Height of the figure in world units. Only the ratios to it matter. */
const FIGURE_HEIGHT = 3.2;

export interface PlaneHandle {
  dispose(): void;
}

/**
 * The 2.5D mascot: the clay render on a plane with a shadow plane behind it,
 * floating and tilting toward the pointer. Moved here from MascotScene.tsx
 * unchanged, so `three` has one importer.
 */
export async function mountPlane(
  el: HTMLElement,
  opts: { src: string; onLive: (live: boolean) => void; isDisposed: () => boolean },
): Promise<PlaneHandle | null> {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    // A context can still be refused after the caller's probe said yes.
    return null;
  }

  const texture = await new TextureLoader().loadAsync(opts.src).catch(() => null);
  if (!texture || opts.isDisposed()) {
    renderer.dispose();
    texture?.dispose();
    return null;
  }
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const scene = new Scene();
  // A narrow field of view keeps the planes near-orthographic, so the mascot
  // reads as artwork rather than as a photograph of a billboard — while still
  // giving the two layers something to parallax against.
  const camera = new PerspectiveCamera(20, 1, 0.1, 100);

  const aspect = texture.image.width / texture.image.height;
  const figureGeo = new PlaneGeometry(FIGURE_HEIGHT * aspect, FIGURE_HEIGHT);
  const figureMat = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const figure = new Mesh(figureGeo, figureMat);

  // The render's own cast shadow was matted out, because it is cream and
  // would halo on a dark surface (see tools/brand/matte-mascot.py). This is
  // its replacement, and it is also what gives the parallax something to move
  // against.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(50, 59, 66, 0.42)"); // brand ink
    g.addColorStop(0.55, "rgba(50, 59, 66, 0.14)");
    g.addColorStop(1, "rgba(50, 59, 66, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const shadowTex = new CanvasTexture(shadowCanvas);
  const shadowGeo = new PlaneGeometry(FIGURE_HEIGHT * aspect * 0.72, FIGURE_HEIGHT * 0.26);
  const shadowMat = new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const shadow = new Mesh(shadowGeo, shadowMat);
  shadow.position.set(0, -FIGURE_HEIGHT * 0.48, -0.6);

  const group = new Group();
  group.add(shadow, figure);
  scene.add(group);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 420ms ease";
  renderer.domElement.setAttribute("aria-hidden", "true");
  el.appendChild(renderer.domElement);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = el;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Frame the figure to the element's height whatever its shape, so the
    // mascot never crops when the column narrows.
    camera.position.z = FIGURE_HEIGHT / 2 / Math.tan((camera.fov * Math.PI) / 360) + 0.6;
    camera.updateProjectionMatrix();
  };
  resize();
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(el);

  // Pointer position as -1..1 within the element, eased toward on each frame
  // so a fast flick does not snap.
  let targetX = 0;
  let targetY = 0;
  const onPointer = (e: PointerEvent) => {
    const box = el.getBoundingClientRect();
    targetX = ((e.clientX - box.left) / box.width) * 2 - 1;
    targetY = ((e.clientY - box.top) / box.height) * 2 - 1;
  };
  const onLeave = () => {
    targetX = 0;
    targetY = 0;
  };
  el.addEventListener("pointermove", onPointer);
  el.addEventListener("pointerleave", onLeave);

  let raf = 0;
  let running = false;
  const startedAt = performance.now();

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - startedAt) / 1000;

    // Idle float. The shadow tightens as the figure rises, which is what sells
    // the height — a shadow of constant size reads as a sticker.
    const lift = Math.sin(t * 0.9) * 0.055;
    figure.position.y = lift;
    const tight = 1 - lift * 1.6;
    shadow.scale.set(tight, tight, 1);
    shadowMat.opacity = 0.85 + lift * 1.2;

    // Ease toward the pointer, and tilt rather than translate: rotation is
    // what makes two coplanar layers separate.
    group.rotation.y += (targetX * 0.16 - group.rotation.y) * 0.06;
    group.rotation.x += (targetY * 0.1 - group.rotation.x) * 0.06;
    group.position.x += (targetX * 0.06 - group.position.x) * 0.06;

    renderer.render(scene, camera);
  };

  const play = () => {
    if (running || opts.isDisposed()) return;
    running = true;
    frame();
  };
  const pause = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  };

  // Only run while it is both on screen and in a foreground tab.
  const visibility = new IntersectionObserver(
    (entries) => (entries.some((e) => e.isIntersecting) ? play() : pause()),
    { threshold: 0.01 },
  );
  visibility.observe(el);
  const onVisibilityChange = () => (document.hidden ? pause() : play());
  document.addEventListener("visibilitychange", onVisibilityChange);

  // A lost context is not rare — switching GPUs on a laptop does it — and
  // without this the canvas goes blank while the fallback image stays hidden
  // behind it, leaving an empty box where the mascot was.
  const onContextLost = (e: Event) => {
    e.preventDefault();
    pause();
    renderer.domElement.style.opacity = "0";
    opts.onLive(false);
  };
  const onContextRestored = () => {
    renderer.domElement.style.opacity = "1";
    opts.onLive(true);
    play();
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

  play();
  renderer.domElement.style.opacity = "1";
  opts.onLive(true);

  return {
    dispose() {
      pause();
      visibility.disconnect();
      sizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      el.removeEventListener("pointermove", onPointer);
      el.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      figureGeo.dispose();
      figureMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      texture.dispose();
      renderer.domElement.remove();
      renderer.dispose();
    },
  };
}
