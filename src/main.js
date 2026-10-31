import QRCode from "qrcode";
import { BANKS } from "./banks.js";
import { createVietQrPayload } from "./vietqr.js";
import "./style.css";

const form = document.querySelector("#transfer-form");
const bankSelect = document.querySelector("#bank");
const errorMessage = document.querySelector("#form-error");
const qrImage = document.querySelector("#qr-image");
const qrPlaceholder = document.querySelector("#qr-placeholder");
const downloadButton = document.querySelector("#download-button");
const elements = {
  name: document.querySelector("#poster-name"),
  account: document.querySelector("#poster-account"),
};
const posterQr = document.querySelector("#poster-qr");
const posterRecipient = document.querySelector("#poster-recipient");
const QR_POSITION = { left: 0.34, top: 0.425, size: 0.32 };
const POSTER_BACKGROUND = `${import.meta.env.BASE_URL}transfer-poster-background.png`;
let currentPosterData = null;

for (const bank of BANKS) {
  const option = document.createElement("option");
  option.value = bank.bin;
  option.textContent = bank.name;
  bankSelect.append(option);
}

function resetPoster() {
  currentPosterData = null;
  qrImage.removeAttribute("src");
  qrImage.alt = "";
  qrImage.hidden = true;
  qrPlaceholder.hidden = false;
  elements.name.textContent = "Tên chủ tài khoản";
  elements.account.textContent = "Số tài khoản";
  posterQr.style.left = `${QR_POSITION.left * 100}%`;
  posterQr.style.top = `${QR_POSITION.top * 100}%`;
  posterQr.style.width = `${QR_POSITION.size * 100}%`;
  posterRecipient.hidden = true;
  downloadButton.disabled = true;
}

resetPoster();
form.addEventListener("input", resetPoster);
form.addEventListener("change", resetPoster);

function readTransferDetails() {
  const formData = new FormData(form);
  const bank = BANKS.find((item) => item.bin === formData.get("bank"));
  const accountNumber = String(formData.get("accountNumber")).trim();
  const accountName = String(formData.get("accountName")).trim().toLocaleUpperCase("vi-VN");
  const amount = String(formData.get("amount")).trim();
  const description = String(formData.get("description")).trim();

  if (!bank) throw new Error("Vui lòng chọn ngân hàng.");
  if (!/^\d{5,19}$/.test(accountNumber)) {
    throw new Error("Số tài khoản cần có từ 5 đến 19 chữ số.");
  }
  if (!accountName || accountName.length > 25) {
    throw new Error("Vui lòng nhập tên chủ tài khoản (tối đa 25 ký tự).");
  }
  if (amount && (!/^\d{1,13}$/.test(amount) || !Number.isSafeInteger(Number(amount)) || Number(amount) < 1)) {
    throw new Error("Số tiền cần là số nguyên VND lớn hơn 0.");
  }
  if (description && new TextEncoder().encode(description).length > 99) {
    throw new Error("Nội dung chuyển khoản quá dài.");
  }

  return { bank, accountNumber, accountName, amount, description };
}

function updatePoster(details, qrDataUrl) {
  elements.name.textContent = details.accountName;
  elements.account.textContent = details.accountNumber;
  posterQr.style.left = `${QR_POSITION.left * 100}%`;
  posterQr.style.top = `${QR_POSITION.top * 100}%`;
  posterQr.style.width = `${QR_POSITION.size * 100}%`;
  posterRecipient.hidden = false;
  qrImage.src = qrDataUrl;
  qrImage.alt = `Mã VietQR chuyển khoản đến ${details.accountName}, ${details.bank.name}`;
  qrImage.hidden = false;
  qrPlaceholder.hidden = true;
  downloadButton.disabled = false;
  currentPosterData = { details, qrDataUrl };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  try {
    const details = readTransferDetails();
    const payload = createVietQrPayload(details);
    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 480,
      color: { dark: "#15372d", light: "#ffffff" },
    });
    updatePoster(details, qrDataUrl);
  } catch (error) {
    errorMessage.textContent =
      error instanceof Error ? error.message : "Không thể tạo mã QR. Vui lòng thử lại.";
    errorMessage.hidden = false;
  }
});

function drawPosterText(context, text, x, y, maxWidth, font) {
  context.font = font;
  let displayText = text;
  while (displayText && context.measureText(displayText).width > maxWidth) {
    displayText = `${displayText.slice(0, -2)}…`;
  }
  context.fillText(displayText, x, y);
}

async function createPosterPng({ details, qrDataUrl }) {
  const background = new Image();
  background.src = POSTER_BACKGROUND;
  await new Promise((resolve, reject) => {
    if (background.complete && background.naturalWidth) {
      resolve();
      return;
    }
    background.addEventListener("load", resolve, { once: true });
    background.addEventListener("error", () => reject(new Error("Không tải được ảnh nền poster.")), {
      once: true,
    });
  });

  const canvas = document.createElement("canvas");
  canvas.width = background.naturalWidth;
  canvas.height = background.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ xuất poster.");

  context.drawImage(background, 0, 0, canvas.width, canvas.height);

  const qr = new Image();
  qr.src = qrDataUrl;
  await new Promise((resolve, reject) => {
    qr.onload = resolve;
    qr.onerror = () => reject(new Error("Không thể tải mã QR để xuất poster."));
  });
  const qrSize = canvas.width * QR_POSITION.size;
  const qrX = canvas.width * QR_POSITION.left;
  const qrY = canvas.height * QR_POSITION.top;
  context.drawImage(qr, qrX, qrY, qrSize, qrSize);

  context.textAlign = "center";
  context.fillStyle = "#475e7d";
  context.font = `bold ${Math.round(canvas.width * 0.014)}px Arial, sans-serif`;
  context.fillText("CHỦ TÀI KHOẢN", canvas.width / 2, canvas.height * 0.666);
  context.fillStyle = "#173b2e";
  context.font = `bold ${Math.round(canvas.width * 0.023)}px Arial, sans-serif`;
  drawPosterText(context, details.accountName, canvas.width / 2, canvas.height * 0.682, canvas.width * 0.39, context.font);
  context.fillStyle = "#53685d";
  context.font = `${Math.round(canvas.width * 0.018)}px Arial, sans-serif`;
  drawPosterText(context, details.accountNumber, canvas.width / 2, canvas.height * 0.699, canvas.width * 0.39, context.font);
  context.textAlign = "left";

  return canvas.toDataURL("image/png");
}

downloadButton.addEventListener("click", async () => {
  if (!currentPosterData) return;
  downloadButton.disabled = true;
  try {
    const png = await createPosterPng(currentPosterData);
    const link = document.createElement("a");
    link.href = png;
    link.download = "vietqr-poster.png";
    link.click();
  } catch (error) {
    errorMessage.textContent =
      error instanceof Error ? error.message : "Không thể xuất poster. Vui lòng thử lại.";
    errorMessage.hidden = false;
  } finally {
    downloadButton.disabled = false;
  }
});
