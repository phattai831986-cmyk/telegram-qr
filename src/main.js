import QRCode from "qrcode";
import { BANKS } from "./banks.js";
import { createVietQrPayload, formatVnd } from "./vietqr.js";
import "./style.css";

const form = document.querySelector("#transfer-form");
const bankSelect = document.querySelector("#bank");
const errorMessage = document.querySelector("#form-error");
const qrImage = document.querySelector("#qr-image");
const qrPlaceholder = document.querySelector("#qr-placeholder");
const downloadButton = document.querySelector("#download-button");
const elements = {
  bank: document.querySelector("#poster-bank"),
  name: document.querySelector("#poster-name"),
  account: document.querySelector("#poster-account"),
  payment: document.querySelector("#poster-payment"),
  amountWrap: document.querySelector("#poster-amount-wrap"),
  amount: document.querySelector("#poster-amount"),
  descriptionWrap: document.querySelector("#poster-description-wrap"),
  description: document.querySelector("#poster-description"),
};
let currentPosterData = null;

for (const bank of BANKS) {
  const option = document.createElement("option");
  option.value = bank.bin;
  option.textContent = bank.name;
  bankSelect.append(option);
}

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
  elements.bank.textContent = details.bank.name.toLocaleUpperCase("vi-VN");
  elements.name.textContent = details.accountName;
  elements.account.textContent = details.accountNumber;
  elements.amount.textContent = formatVnd(details.amount);
  elements.description.textContent = details.description;
  elements.amountWrap.hidden = !details.amount;
  elements.descriptionWrap.hidden = !details.description;
  elements.payment.hidden = !details.amount && !details.description;
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

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawPosterText(context, text, x, y, maxWidth, font) {
  context.font = font;
  let displayText = text;
  while (displayText && context.measureText(displayText).width > maxWidth) {
    displayText = `${displayText.slice(0, -2)}…`;
  }
  context.fillText(displayText, x, y);
}

async function createPosterPng({ details, qrDataUrl }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1420;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ xuất poster.");

  context.fillStyle = "#f2f7f3";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#dceee1";
  context.beginPath();
  context.arc(1000, 0, 290, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#e5f1e8";
  context.beginPath();
  context.arc(0, 1420, 260, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#fff";
  roundedRect(context, 82, 62, 836, 1296, 40);
  context.fill();

  context.fillStyle = "#198754";
  roundedRect(context, 130, 112, 60, 60, 18);
  context.fill();
  context.fillStyle = "#fff";
  context.font = "bold 36px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("V", 160, 153);
  context.textAlign = "left";
  context.fillStyle = "#173b2e";
  context.font = "bold 30px Arial, sans-serif";
  context.fillText("VietQR", 205, 151);
  context.fillStyle = "#73877d";
  context.font = "bold 16px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText("CHUYỂN KHOẢN", 870, 149);
  context.textAlign = "left";

  context.fillStyle = "#183d30";
  context.font = "42px Arial, sans-serif";
  context.fillText("Quét mã để", 130, 252);
  context.font = "bold 54px Arial, sans-serif";
  context.fillText("chuyển khoản", 130, 319);

  context.fillStyle = "#eaf5ed";
  roundedRect(context, 130, 356, 740, 54, 15);
  context.fill();
  context.fillStyle = "#21804e";
  context.font = "bold 20px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(details.bank.name.toLocaleUpperCase("vi-VN"), 500, 391);
  context.textAlign = "left";

  const qr = new Image();
  qr.src = qrDataUrl;
  await new Promise((resolve, reject) => {
    qr.onload = resolve;
    qr.onerror = () => reject(new Error("Không thể tải mã QR để xuất poster."));
  });
  context.fillStyle = "#fff";
  roundedRect(context, 328, 437, 344, 344, 20);
  context.fill();
  context.drawImage(qr, 350, 459, 300, 300);

  context.fillStyle = "#75877e";
  context.font = "bold 15px Arial, sans-serif";
  context.fillText("CHỦ TÀI KHOẢN", 150, 837);
  context.fillStyle = "#173b2e";
  drawPosterText(context, details.accountName, 150, 884, 700, "bold 30px Arial, sans-serif");
  context.fillStyle = "#53685d";
  context.font = "22px Arial, sans-serif";
  context.fillText(details.accountNumber, 150, 924);

  let detailY = 980;
  if (details.amount) {
    context.fillStyle = "#f5f9f6";
    roundedRect(context, 130, detailY, 740, 76, 14);
    context.fill();
    context.fillStyle = "#75877e";
    context.font = "bold 14px Arial, sans-serif";
    context.fillText("SỐ TIỀN", 154, detailY + 29);
    context.fillStyle = "#198754";
    context.font = "bold 24px Arial, sans-serif";
    context.fillText(formatVnd(details.amount), 154, detailY + 58);
    detailY += 92;
  }
  if (details.description) {
    context.fillStyle = "#f5f9f6";
    roundedRect(context, 130, detailY, 740, 76, 14);
    context.fill();
    context.fillStyle = "#75877e";
    context.font = "bold 14px Arial, sans-serif";
    context.fillText("NỘI DUNG", 154, detailY + 29);
    context.fillStyle = "#173b2e";
    drawPosterText(context, details.description, 154, detailY + 57, 690, "bold 20px Arial, sans-serif");
  }

  context.fillStyle = "#e6eee8";
  context.fillRect(130, 1254, 740, 1);
  context.fillStyle = "#21804e";
  context.beginPath();
  context.arc(151, 1295, 7, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#53685d";
  context.font = "18px Arial, sans-serif";
  context.fillText("Mở ứng dụng ngân hàng và quét mã", 172, 1301);

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
