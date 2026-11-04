// Square QR slot as fractions of the poster width/height (matches the BHXH template).
export const DEFAULT_QR_SLOT = { left: 0.3337, top: 0.4453, size: 0.3326 };
export const POSTER_TEMPLATE_PATH = "templates/poster.png";
export const POSTER_SLOT_PATH = "templates/poster-slot.json";
export const MAX_TEMPLATE_BYTES = 8 * 1024 * 1024;

export function normalizeQrSlot(value, fallback = DEFAULT_QR_SLOT) {
  const left = Number(value?.left);
  const top = Number(value?.top);
  const size = Number(value?.size);
  const valid =
    [left, top, size].every(Number.isFinite) &&
    size >= 0.05 &&
    left >= 0 &&
    top >= 0 &&
    left + size <= 1 &&
    top <= 1;
  return valid ? { left, top, size } : { ...fallback };
}

export function validateTemplateFile(file) {
  if (!file) return "Hãy chọn ảnh poster PNG.";
  if (file.type !== "image/png") return "Poster mẫu cần là tệp PNG.";
  if (file.size > MAX_TEMPLATE_BYTES) return "Poster mẫu tối đa 8 MB.";
  return null;
}

export function slotToStyle(slot) {
  return {
    left: `${slot.left * 100}%`,
    top: `${slot.top * 100}%`,
    width: `${slot.size * 100}%`,
  };
}
