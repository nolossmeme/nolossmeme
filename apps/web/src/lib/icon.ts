/** Shrinks an uploaded image to a small square data URI for the token's on-chain icon (NEP-148).
 *  Center-cropped, 96 px, WebP where the browser can encode it (PNG otherwise). */
export const ICON_PX = 96;
/** Keeps the factory storage (paid by the launch deposit) small. */
export const ICON_MAX_BYTES = 24_000;

export async function imageToIcon(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = ICON_PX;
  canvas.height = ICON_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    ICON_PX,
    ICON_PX,
  );
  bitmap.close();
  const url = canvas.toDataURL("image/webp", 0.85);
  if (url.length > ICON_MAX_BYTES) throw new Error("image too detailed, try a simpler one");
  return url;
}
