import QRCode from "qrcode";
import { BANKS } from "./banks.js";
import { createVietQrPayload } from "./vietqr.js";
import { supabase, supabaseConfigured } from "./supabase.js";
import { initializeTelegramMiniApp } from "./telegram.js";
import "./style.css";

const form = document.querySelector("#transfer-form");
const bankSelect = document.querySelector("#bank");
const accountModeSelect = document.querySelector("#account-mode");
const savedAccountSelect = document.querySelector("#saved-account");
const errorMessage = document.querySelector("#form-error");
const qrImage = document.querySelector("#qr-image");
const qrPlaceholder = document.querySelector("#qr-placeholder");
const downloadButton = document.querySelector("#download-button");
const saveAccountButton = document.querySelector("#save-account-button");
const setDefaultAccountButton = document.querySelector("#set-default-account-button");
const savePosterButton = document.querySelector("#save-poster-button");
const restorePosterButton = document.querySelector("#restore-poster-button");
const sharePosterButton = document.querySelector("#share-poster-button");
const authForm = document.querySelector("#auth-form");
const signUpButton = document.querySelector("#sign-up-button");
const signOutButton = document.querySelector("#sign-out-button");
const syncStatus = document.querySelector("#sync-status");
const elements = {
  name: document.querySelector("#poster-name"),
  account: document.querySelector("#poster-account"),
};
const posterQr = document.querySelector("#poster-qr");
const posterRecipient = document.querySelector("#poster-recipient");
const telegramApp = initializeTelegramMiniApp();
const telegramMainButton = telegramApp?.MainButton;
const QR_POSITION = { left: 0.34, top: 0.425, size: 0.32 };
const POSTER_BACKGROUND = `${import.meta.env.BASE_URL}transfer-poster-background.png`;
let currentPosterData = null;
let currentPosterBlob = null;
let currentUser = null;
let isGenerating = false;
let savedProfiles = [];
let selectedProfileId = null;
const POSTER_BUCKET = "transfer-posters";

function updateTelegramMainButton() {
  if (!telegramMainButton) return;
  telegramMainButton.setText(currentPosterData ? "Tải poster PNG" : "Tạo mã QR chuyển khoản");
  if (isGenerating) telegramMainButton.disable();
  else telegramMainButton.enable();
  telegramMainButton.show();
}

if (telegramMainButton?.onClick) {
  telegramMainButton.onClick(() => {
    if (isGenerating) return;
    if (currentPosterData) downloadButton.click();
    else form.requestSubmit();
  });
  updateTelegramMainButton();
}

function setSyncStatus(message, isError = false) {
  syncStatus.textContent = message;
  syncStatus.dataset.state = isError ? "error" : "ready";
}

function updateSyncControls() {
  const signedIn = Boolean(currentUser);
  const hasTransfer = Boolean(currentPosterData);
  const selectedProfile = savedProfiles.find((profile) => profile.id === selectedProfileId);
  const defaultProfile = savedProfiles.find((profile) => profile.is_default);
  const activeProfile = accountModeSelect.value === "fixed" ? defaultProfile : selectedProfile;
  authForm.querySelector("#auth-email").disabled = signedIn || !supabaseConfigured;
  authForm.querySelector("#auth-password").disabled = signedIn || !supabaseConfigured;
  authForm.querySelector("#sign-in-button").hidden = signedIn;
  authForm.querySelector("#sign-in-button").disabled = !supabaseConfigured;
  signUpButton.hidden = signedIn;
  signUpButton.disabled = !supabaseConfigured;
  signOutButton.hidden = !signedIn;
  saveAccountButton.disabled = !signedIn;
  savedAccountSelect.disabled =
    !signedIn || savedProfiles.length === 0 || accountModeSelect.value === "fixed";
  setDefaultAccountButton.disabled = !signedIn || !selectedProfile || selectedProfile.is_default;
  for (const control of [bankSelect, form.elements.accountNumber, form.elements.accountName]) {
    control.disabled = Boolean(activeProfile);
  }
  savePosterButton.disabled = !signedIn || !hasTransfer;
  restorePosterButton.disabled = !signedIn;
  sharePosterButton.disabled = !hasTransfer;
  if (!supabaseConfigured) {
    setSyncStatus("Đồng bộ cần cấu hình Supabase. Tạo QR và tải poster vẫn dùng được bình thường.", true);
  }
}

for (const bank of BANKS) {
  const option = document.createElement("option");
  option.value = bank.bin;
  option.textContent = bank.name;
  bankSelect.append(option);
}

function resetPoster() {
  currentPosterData = null;
  currentPosterBlob = null;
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
  updateTelegramMainButton();
  updateSyncControls();
}

resetPoster();
for (const control of [
  bankSelect,
  form.elements.accountNumber,
  form.elements.accountName,
  form.elements.amount,
  form.elements.description,
]) {
  control.addEventListener("input", resetPoster);
  control.addEventListener("change", resetPoster);
}

function fillTransferForm(profile) {
  selectedProfileId = profile?.id ?? null;
  savedAccountSelect.value = profile?.id ?? "new";
  const disabled = Boolean(profile);
  bankSelect.disabled = disabled;
  form.elements.accountNumber.disabled = disabled;
  form.elements.accountName.disabled = disabled;
  bankSelect.value = profile?.bank_bin ?? "";
  form.elements.accountNumber.value = profile?.account_number ?? "";
  form.elements.accountName.value = profile?.account_name ?? "";
  form.elements.amount.value = profile?.amount ?? "";
  form.elements.description.value = profile?.description ?? "";
  resetPoster();
}

function renderSavedProfiles() {
  savedAccountSelect.replaceChildren();
  const newOption = document.createElement("option");
  newOption.value = "new";
  newOption.textContent = "Nhập tài khoản mới…";
  savedAccountSelect.append(newOption);

  for (const profile of savedProfiles) {
    const bank = BANKS.find((item) => item.bin === profile.bank_bin);
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${bank?.name ?? profile.bank_bin} · ${profile.account_number} · ${profile.account_name}${profile.is_default ? " (Mặc định)" : ""}`;
    savedAccountSelect.append(option);
  }

  if (accountModeSelect.value === "fixed") {
    fillTransferForm(savedProfiles.find((profile) => profile.is_default) ?? null);
  } else {
    fillTransferForm(savedProfiles.find((profile) => profile.id === selectedProfileId) ?? null);
  }
  updateSyncControls();
}

async function loadSavedProfiles() {
  if (!currentUser || !supabase) return;
  const { data, error } = await supabase
    .from("transfer_profiles")
    .select("id,bank_bin,account_number,account_name,amount,description,is_default")
    .eq("user_id", currentUser.id)
    .order("is_default", { ascending: false })
    .order("account_name", { ascending: true });
  if (error) throw error;
  savedProfiles = data ?? [];
  renderSavedProfiles();

  if (savedProfiles.length === 0) {
    setSyncStatus("Đã đăng nhập. Lưu tài khoản để đặt tài khoản cố định hoặc chọn nhiều tài khoản.");
  } else if (!savedProfiles.some((profile) => profile.is_default)) {
    accountModeSelect.value = "optional";
    fillTransferForm(savedProfiles[0]);
    setSyncStatus("Chọn một tài khoản đã lưu hoặc đặt tài khoản đang chọn làm tài khoản cố định.");
  } else {
    setSyncStatus("Đã tải danh sách tài khoản riêng tư. Chọn chế độ cố định hoặc tùy chọn.");
  }
}

accountModeSelect.addEventListener("change", () => {
  if (accountModeSelect.value === "fixed") {
    const defaultProfile = savedProfiles.find((profile) => profile.is_default);
    if (currentUser && savedProfiles.length > 0 && !defaultProfile) {
      accountModeSelect.value = "optional";
      setSyncStatus("Chọn một tài khoản rồi đặt làm mặc định trước khi dùng chế độ cố định.", true);
      return;
    }
    fillTransferForm(defaultProfile ?? null);
  } else {
    fillTransferForm(savedProfiles.find((profile) => profile.id === selectedProfileId) ?? null);
  }
  updateSyncControls();
});

savedAccountSelect.addEventListener("change", () => {
  fillTransferForm(savedProfiles.find((profile) => profile.id === savedAccountSelect.value) ?? null);
  updateSyncControls();
});

async function loadSavedPoster({ download = false } = {}) {
  if (!currentUser || !supabase) return null;
  const { data, error } = await supabase.storage
    .from(POSTER_BUCKET)
    .download(`${currentUser.id}/poster.png`);
  if (error) {
    if (error.message.includes("Object not found")) {
      setSyncStatus("Bạn chưa lưu poster trên tài khoản này.");
      return null;
    }
    throw error;
  }
  if (download) downloadBlob(data, "vietqr-poster.png");
  return data;
}

async function getCurrentPosterBlob() {
  if (!currentPosterData) throw new Error("Hãy tạo mã QR trước.");
  if (!currentPosterBlob) currentPosterBlob = await createPosterPng(currentPosterData);
  return currentPosterBlob;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const email = authForm.elements.email.value.trim();
  const password = authForm.elements.password.value;
  const submitButton = authForm.querySelector("#sign-in-button");
  submitButton.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    authForm.elements.password.value = "";
    setSyncStatus("Đã đăng nhập. Đang tải danh sách tài khoản…");
  } catch (error) {
    setSyncStatus(error instanceof Error ? error.message : "Không thể đăng nhập.", true);
  } finally {
    submitButton.disabled = false;
  }
});

signUpButton.addEventListener("click", async () => {
  if (!supabase) return;
  const email = authForm.elements.email.value.trim();
  const password = authForm.elements.password.value;
  if (!email || password.length < 8) {
    setSyncStatus("Nhập email hợp lệ và mật khẩu có ít nhất 8 ký tự để tạo tài khoản.", true);
    return;
  }
  signUpButton.disabled = true;
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    authForm.elements.password.value = "";
    setSyncStatus(
      data.session
        ? "Đã tạo tài khoản và đăng nhập."
        : "Đã tạo tài khoản. Hãy xác nhận email rồi đăng nhập.",
    );
  } catch (error) {
    setSyncStatus(error instanceof Error ? error.message : "Không thể tạo tài khoản.", true);
  } finally {
    signUpButton.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) setSyncStatus(error.message, true);
  else setSyncStatus("Đã đăng xuất. Dữ liệu lưu trên đám mây vẫn được bảo vệ trong tài khoản.");
});

saveAccountButton.addEventListener("click", async () => {
  if (!currentUser || !supabase) return;
  saveAccountButton.disabled = true;
  try {
    const details = readTransferDetails();
    const { data, error } = await supabase
      .from("transfer_profiles")
      .upsert(
        {
          user_id: currentUser.id,
          bank_bin: details.bank.bin,
          account_number: details.accountNumber,
          account_name: details.accountName,
          amount: details.amount,
          description: details.description,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,bank_bin,account_number" },
      )
      .select("id,is_default")
      .single();
    if (error) throw error;
    await loadSavedProfiles();
    accountModeSelect.value = savedProfiles.some((profile) => profile.is_default) ? "optional" : "fixed";
    fillTransferForm(savedProfiles.find((profile) => profile.id === data.id));
    if (!savedProfiles.some((profile) => profile.is_default)) {
      await setDefaultAccount(data.id);
    } else {
      setSyncStatus("Đã lưu tài khoản riêng tư. Có thể lưu thêm tài khoản để chọn ở chế độ tùy chọn.");
    }
  } catch (error) {
    setSyncStatus(error instanceof Error ? error.message : "Không thể lưu thông tin tài khoản.", true);
  } finally {
    updateSyncControls();
  }
});

async function setDefaultAccount(profileId) {
  if (!supabase) return;
  const { error } = await supabase.rpc("set_default_transfer_profile", { profile_id: profileId });
  if (error) throw error;
  accountModeSelect.value = "fixed";
  await loadSavedProfiles();
  setSyncStatus("Đã đặt tài khoản cố định mặc định.");
}

setDefaultAccountButton.addEventListener("click", async () => {
  if (!selectedProfileId) return;
  setDefaultAccountButton.disabled = true;
  try {
    await setDefaultAccount(selectedProfileId);
  } catch (error) {
    setSyncStatus(error instanceof Error ? error.message : "Không thể đặt tài khoản mặc định.", true);
  } finally {
    updateSyncControls();
  }
});

savePosterButton.addEventListener("click", async () => {
  if (!currentUser || !supabase) return;
  savePosterButton.disabled = true;
  try {
    const blob = await getCurrentPosterBlob();
    const { error } = await supabase.storage
      .from(POSTER_BUCKET)
      .upload(`${currentUser.id}/poster.png`, blob, { contentType: "image/png", upsert: true });
    if (error) throw error;
    setSyncStatus("Đã lưu poster PNG riêng tư. Bạn có thể tải lại trên thiết bị khác sau khi đăng nhập.");
  } catch (error) {
    setSyncStatus(error instanceof Error ? error.message : "Không thể lưu poster.", true);
  } finally {
    updateSyncControls();
  }
});

restorePosterButton.addEventListener("click", async () => {
  restorePosterButton.disabled = true;
  try {
    const blob = await loadSavedPoster({ download: true });
    if (blob) setSyncStatus("Đã tải poster PNG từ tài khoản của bạn.");
  } catch (error) {
    setSyncStatus(error instanceof Error ? error.message : "Không thể tải poster đã lưu.", true);
  } finally {
    updateSyncControls();
  }
});

sharePosterButton.addEventListener("click", async () => {
  sharePosterButton.disabled = true;
  try {
    const blob = await getCurrentPosterBlob();
    const file =
      typeof File === "undefined" ? null : new File([blob], "vietqr-poster.png", { type: "image/png" });
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Poster QR chuyển khoản",
        text: "Quét mã QR để chuyển khoản.",
      });
      setSyncStatus("Đã mở bảng chia sẻ. Chọn Telegram, nhóm hoặc ứng dụng muốn gửi.");
    } else {
      downloadBlob(blob, "vietqr-poster.png");
      setSyncStatus("Trình duyệt này chưa hỗ trợ gửi ảnh trực tiếp. Poster đã tải xuống; hãy đính kèm ảnh trong Telegram hoặc ứng dụng khác.");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    setSyncStatus(error instanceof Error ? error.message : "Không thể chia sẻ poster.", true);
  } finally {
    updateSyncControls();
  }
});

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    if (!currentUser) {
      savedProfiles = [];
      selectedProfileId = null;
      renderSavedProfiles();
      setSyncStatus("Đăng nhập để lưu riêng tư và đồng bộ trên các thiết bị.");
      return;
    }
    updateSyncControls();
    setSyncStatus(`Đã đăng nhập: ${currentUser.email}. Đang tải danh sách tài khoản…`);
    window.setTimeout(() => {
      loadSavedProfiles().catch((error) =>
        setSyncStatus(error instanceof Error ? error.message : "Không thể tải dữ liệu.", true),
      );
    }, 0);
  });
} else {
  updateSyncControls();
}

function readTransferDetails() {
  const formData = new FormData(form);
  const bank = BANKS.find((item) => item.bin === bankSelect.value);
  const accountNumber = form.elements.accountNumber.value.trim();
  const accountName = form.elements.accountName.value.trim().toLocaleUpperCase("vi-VN");
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
  currentPosterBlob = null;
  updateTelegramMainButton();
  updateSyncControls();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  isGenerating = true;
  updateTelegramMainButton();
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
    currentPosterBlob = await createPosterPng(currentPosterData);
    updateSyncControls();
  } catch (error) {
    errorMessage.textContent =
      error instanceof Error ? error.message : "Không thể tạo mã QR. Vui lòng thử lại.";
    errorMessage.hidden = false;
  } finally {
    isGenerating = false;
    updateTelegramMainButton();
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

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Không thể tạo ảnh PNG."));
    }, "image/png");
  });
}

downloadButton.addEventListener("click", async () => {
  if (!currentPosterData) return;
  downloadButton.disabled = true;
  try {
    const blob = await getCurrentPosterBlob();
    downloadBlob(blob, "vietqr-poster.png");
  } catch (error) {
    errorMessage.textContent =
      error instanceof Error ? error.message : "Không thể xuất poster. Vui lòng thử lại.";
    errorMessage.hidden = false;
  } finally {
    downloadButton.disabled = false;
  }
});
