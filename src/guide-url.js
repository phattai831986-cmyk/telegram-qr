const OFFICIAL_DOMAINS = ["baohiemxahoi.gov.vn", "vssid.gov.vn"];
export const DEFAULT_GUIDE_URL = "https://baohiemxahoi.gov.vn/";

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
