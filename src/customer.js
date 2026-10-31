import QRCode from "qrcode";
import { normalizeGuideUrl } from "./guide-url.js";
import {
  defaultPosterPath,
  supabase,
  supabaseConfigurationError,
  supabaseConfigured,
} from "./supabase.js";
import "./customer.css";

const template = document.querySelector("#poster-template");
const posterCanvas = document.querySelector("#poster-canvas");
const qrImage = document.querySelector("#poster-qr");
const statusMessage = document.querySelector("#status-message");
const destinationNote = document.querySelector("#destination-note");
const downloadButton = document.querySelector("#download-button");

let posterData = null;
let settings = {
  destination_url: "",
  poster_url: defaultPosterPath,
  qr_x_percent: 33,
  qr_y_percent: 43,
  qr_size_percent: 34,
};

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.dataset.state = "error";
}

function setQrPosition() {
  posterCanvas.style.aspectRatio = `${template.naturalWidth} / ${template.naturalHeight}`;
  qrImage.style.left = `${settings.qr_x_percent}%`;
  qrImage.style.top = `${settings.qr_y_percent}%`;
  qrImage.style.width = `${settings.qr_size_percent}%`;
  qrImage.style.height = `${
    (settings.qr_size_percent * template.naturalWidth) / template.naturalHeight
  }%`;
}

async function loadSettings() {
  if (supabaseConfigured) {
    const { data, error } = await supabase
      .from("site_settings")
      .select("destination_url,poster_url,qr_x_percent,qr_y_percent,qr_size_percent")
      .eq("id", "default")
      .single();
    if (error) throw new Error(`Không tải được cấu hình: ${error.message}`);
    settings = { ...settings, ...data };
  }

  template.crossOrigin = settings.poster_url.startsWith("http") ? "anonymous" : "";
  template.src = settings.poster_url || defaultPosterPath;
  await new Promise((resolve, reject) => {
    if (template.complete && template.naturalWidth) {
      resolve();
      return;
    }
    template.addEventListener("load", resolve, { once: true });
    template.addEventListener("error", () => reject(new Error("Không tải được ảnh poster.")), {
      once: true,
    });
  });

  if (!settings.destination_url) {
    statusMessage.textContent = supabaseConfigured
      ? "Quản trị viên chưa cấu hình liên kết hướng dẫn."
      : supabaseConfigurationError || "Trang cần cấu hình Supabase trước khi tạo mã QR.";
    return;
  }

  const destination = normalizeGuideUrl(settings.destination_url);
  setQrPosition();
  qrImage.src = await QRCode.toDataURL(destination, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 640,
    color: { dark: "#102e55", light: "#ffffff" },
  });
  qrImage.hidden = false;
  statusMessage.textContent = "Mã QR dẫn tới trang hướng dẫn BHXH/VssID.";
  destinationNote.textContent = `Đường dẫn đích: ${new URL(destination).hostname}`;
  destinationNote.hidden = false;
  downloadButton.disabled = false;
  posterData = { destination, image: template, settings: { ...settings } };
}

async function exportPoster({ destination, image, settings: position }) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ xuất ảnh.");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const x = (canvas.width * position.qr_x_percent) / 100;
  const y = (canvas.height * position.qr_y_percent) / 100;
  const size = (canvas.width * position.qr_size_percent) / 100;
  const qrData = await QRCode.toDataURL(destination, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: Math.ceil(size),
    color: { dark: "#102e55", light: "#ffffff" },
  });
  const qr = new Image();
  qr.src = qrData;
  await new Promise((resolve, reject) => {
    qr.onload = resolve;
    qr.onerror = () => reject(new Error("Không thể tạo ảnh mã QR."));
  });
  context.drawImage(qr, x, y, size, size);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "poster-huong-dan-bhxh.png";
  link.click();
}

downloadButton.addEventListener("click", async () => {
  if (!posterData) return;
  downloadButton.disabled = true;
  try {
    await exportPoster(posterData);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Không thể tải poster.");
  } finally {
    downloadButton.disabled = false;
  }
});

loadSettings().catch((error) => {
  template.src = defaultPosterPath;
  showError(error instanceof Error ? error.message : "Không tải được cấu hình poster.");
});
