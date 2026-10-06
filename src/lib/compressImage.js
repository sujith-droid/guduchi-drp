// Shrinks big phone photos before upload so they send much faster on mobile data.
// Non-images, GIFs and already-small files are returned untouched.
const MAX_SIDE = 1600;
const QUALITY = 0.8;
const SKIP_BELOW_BYTES = 400 * 1024;
// Guard against browsers that hang on createImageBitmap/toBlob for certain
// formats (e.g. HEIC) — if compression hasn't finished in this time, fall back
// to the original file so the upload (and the attach buttons) don't stall.
const TIMEOUT_MS = 12000;

async function doCompress(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export async function compressImage(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < SKIP_BELOW_BYTES) {
    return file;
  }
  try {
    return await Promise.race([
      doCompress(file),
      new Promise((resolve) => setTimeout(() => resolve(file), TIMEOUT_MS)),
    ]);
  } catch {
    // e.g. a format this browser can't decode — just send the original
    return file;
  }
}