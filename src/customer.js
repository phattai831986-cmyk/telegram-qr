import QRCode from "qrcode";
import { DEFAULT_GUIDE_URL, normalizeGuideUrl } from "./guide-url.js";
import "./customer.css";

const template = document.querySelector("#poster-template");
const qrImage = document.querySelector("#poster-qr");
const statusMessage = document.querySelector("#status-message");
const destinationNote = document.querySelector("#destination-note");
const downloadButton = document.querySelector("#download-button");

const posterPath = `${import.meta.env.BASE_URL}bhxh-guide-template.png`;
let posterData = null;
const qrPosition = { x: 33, y: 43, size: 34 };

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.dataset.state = "error";
}

async function loadPoster() {
  template.src = posterPath;
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

  const destination = normalizeGuideUrl(DEFAULT_GUIDE_URL);
  qrImage.style.left = `${qrPosition.x}%`;
  qrImage.style.top = `${qrPosition.y}%`;
  qrImage.style.width = `${qrPosition.size}%`;
  qrImage.style.height = `${
    (qrPosition.size * template.naturalWidth) / template.naturalHeight
  }%`;
  qrImage.src = await QRCode.toDataURL(destination, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 640,
    color: { dark: "#102e55", light: "#ffffff" },
  });
  qrImage.hidden = false;
  statusMessage.textContent = "Mã QR dẫn tới trang chủ chính thức của Bảo hiểm xã hội Việt Nam.";
  destinationNote.textContent = `Đường dẫn đích: ${new URL(destination).hostname}`;
  destinationNote.hidden = false;
  downloadButton.disabled = false;
  posterData = { destination, image: template };
}

async function exportPoster({ destination, image }) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ xuất ảnh.");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const x = (canvas.width * qrPosition.x) / 100;
  const y = (canvas.height * qrPosition.y) / 100;
  const size = (canvas.width * qrPosition.size) / 100;
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

loadPoster().catch((error) => {
  template.src = posterPath;
  showError(error instanceof Error ? error.message : "Không tải được poster hoặc tạo mã QR.");
});
