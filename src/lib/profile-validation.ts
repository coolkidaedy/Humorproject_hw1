export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export function validateNames(first: unknown, last: unknown) {
  if (typeof first !== "string" || typeof last !== "string") return null;
  const first_name = first.trim(), last_name = last.trim();
  if (!first_name || !last_name || first_name.length > 100 || last_name.length > 100) return null;
  return { first_name, last_name };
}
export function photoExtension(bytes: Uint8Array, mime: string): string | null {
  if (mime === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (mime === "image/png" && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) return "png";
  if (mime === "image/webp" && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return "webp";
  return null;
}
