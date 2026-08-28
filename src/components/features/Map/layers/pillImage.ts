import type mapboxgl from "mapbox-gl";

const roundRect = (
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const radius = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + radius, y);
  g.lineTo(x + w - radius, y);
  g.quadraticCurveTo(x + w, y, x + w, y + radius);
  g.lineTo(x + w, y + h - radius);
  g.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  g.lineTo(x + radius, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - radius);
  g.lineTo(x, y + radius);
  g.quadraticCurveTo(x, y, x + radius, y);
  g.closePath();
};

/**
 * Registers a rounded-rect pill as a 9-slice stretchable image.
 *
 * `stretchX`/`stretchY` tell Mapbox which band may be stretched, so
 * `icon-text-fit: "both"` grows the middle to fit the label while the rounded
 * corners keep their radius. Without the 9-slice metadata the whole pill scales
 * and the corners smear.
 *
 * Re-registered on theme change: this is a raster image, so `icon-color` cannot
 * tint it. (An SDF image would be tintable but loses the crisp 1px border at
 * label sizes, which is the entire look.)
 */
export const ensurePillImage = (map: mapboxgl.Map, id: string, fill: string, stroke: string) => {
  if (map.hasImage(id)) map.removeImage(id);

  const W = 128;
  const H = 64;
  const R = 32;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return;

  g.fillStyle = fill;
  g.strokeStyle = stroke;
  g.lineWidth = 2;
  roundRect(g, 1, 1, W - 2, H - 2, R);
  g.fill();
  g.stroke();

  map.addImage(id, g.getImageData(0, 0, W, H), {
    // Authored at 2x so the border stays crisp on retina.
    pixelRatio: 2,
    stretchX: [[R, W - R]],
    stretchY: [[R - 8, R + 8]],
    content: [R - 8, 10, W - R + 8, H - 10],
  });
};
