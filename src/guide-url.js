const OFFICIAL_DOMAINS = ["baohiemxahoi.gov.vn", "vssid.gov.vn"];
const POSTER_ASPECT_RATIO = 881 / 1280;

export function normalizeGuideUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Nhập đường dẫn hướng dẫn hợp lệ, bắt đầu bằng https://.");
  }

  const isOfficialDomain = OFFICIAL_DOMAINS.some(
    (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
  );
  if (url.protocol !== "https:" || !isOfficialDomain || url.username || url.password) {
    throw new Error("Chỉ chấp nhận liên kết HTTPS thuộc baohiemxahoi.gov.vn hoặc vssid.gov.vn.");
  }

  return url.href;
}

export function validateQrPlacement(x, y, size, posterAspectRatio = POSTER_ASPECT_RATIO) {
  const qrHeightPercent = size * posterAspectRatio;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(size) ||
    x < 0 ||
    y < 0 ||
    size < 5 ||
    x + size > 100 ||
    y + qrHeightPercent > 100
  ) {
    throw new Error("Vị trí và kích thước QR phải nằm gọn trong poster.");
  }
}

export function matchesPosterAspectRatio(width, height) {
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    Math.abs(width / height - POSTER_ASPECT_RATIO) <= 0.005
  );
}
