import QRCode from "qrcode";
import { BANKS } from "./banks.js";
import { createVietQrPayload } from "./vietqr.js";
import { supabase, supabaseConfigured } from "./supabase.js";
import { createTelegramShareUrl, initializeTelegramMiniApp } from "./telegram.js";
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
const shareTelegramButton = document.querySelector("#share-telegram-button");
const authForm = document.querySelector("#auth-form");
const signUpButton = document.querySelector("#sign-up-button");
const signOutButton = document.querySelector("#sign-out-button");
const syncStatus = document.querySelector("#sync-status");
const accessGate = document.querySelector("#access-gate");
const accessMessage = document.querySelector("#access-message");
const accessGateStatus = document.querySelector("#access-gate-status");
const requestAccessButton = document.querySelector("#request-access-button");
const studioLayout = document.querySelector("#studio-layout");
const accessAdminPanel = document.querySelector("#access-admin-panel");
const accessAdminStatus = document.querySelector("#access-admin-status");
const accessRequestList = document.querySelector("#access-request-list");
const refreshAccessRequestsButton = document.querySelector("#refresh-access-requests");
const posterQr = document.querySelector("#poster-qr");
const telegramApp = initializeTelegramMiniApp();
const telegramMainButton = telegramApp?.MainButton;
const QR_POSITION = { left: 0.34, top: 0.454, size: 0.32 };
const POSTER_BACKGROUND = `${import.meta.env.BASE_URL}transfer-poster-background-20261102.png`;
let currentPosterData = null;
let currentPosterBlob = null;
let currentUser = null;
let isAccessApproved = false;
let isAccessAdmin = false;
let isGenerating = false;
let savedProfiles = [];
let selectedProfileId = null;
const POSTER_BUCKET = "transfer-posters";

function updateTelegramMainButton() {
  if (!telegramMainButton) return;
  if (!isAccessApproved) {
    telegramMainButton.hide();
    return;
  }
  telegramMainButton.setText(currentPosterData ? "Tải poster PNG" : "Tạo mã QR chuyển khoản");
  if (isGenerating) telegramMainButton.disable();
  else telegramMainButton.enable();
  telegramMainButton.show();
}

if (telegramMainButton?.onClick) {
  telegramMainButton.onClick(() => {
    if (isGenerating || !isAccessApproved) return;
    if (currentPosterData) downloadButton.click();
    else form.requestSubmit();
  });
  updateTelegramMainButton();
}

function setSyncStatus(message, isError = false) {
  syncStatus.textContent = message;
  syncStatus.dataset.state = isError ? "error" : "ready";
}

function showAccessGate(message, { canRequest = false, buttonText = "Gửi yêu cầu sử dụng" } = {}) {
  accessGate.hidden = false;
  studioLayout.hidden = true;
  accessMessage.textContent = message;
  requestAccessButton.hidden = !canRequest;
  requestAccessButton.textContent = buttonText;
}

function updateSyncControls() {
  const signedIn = Boolean(currentUser);
  const hasAccess = Boolean(currentUser && isAccessApproved);
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
  saveAccountButton.disabled = !hasAccess;
  savedAccountSelect.disabled =
    !hasAccess || savedProfiles.length === 0 || accountModeSelect.value === "fixed";
  setDefaultAccountButton.disabled = !hasAccess || !selectedProfile || selectedProfile.is_default;
  for (const control of [bankSelect, form.elements.accountNumber, form.elements.accountName]) {
    control.disabled = Boolean(activeProfile);
  }
  savePosterButton.disabled = !hasAccess || !hasTransfer;
  restorePosterButton.disabled = !hasAccess;
  sharePosterButton.disabled = !hasAccess || !hasTransfer;
  if (!supabaseConfigured) {
    setSyncStatus("Cần cấu hình Supabase để đăng nhập và kiểm tra quyền sử dụng.", true);
  }
}

async function loadAccessRequests() {
  if (!supabase || !isAccessAdmin) return;
  accessAdminStatus.textContent = "Đang tải yêu cầu…";
  const { data, error } = await supabase.rpc("list_app_access_requests");
  if (error) throw error;

  accessRequestList.replaceChildren();
  for (const request of data ?? []) {
    const item = document.createElement("li");
    item.className = "access-request-item";

    const details = document.createElement("div");
    details.className = "access-request-details";
    const email = document.createElement("strong");
    email.textContent = request.email || "Email không khả dụng";
    const status = document.createElement("span");
    status.textContent =
      request.status === "approved"
        ? "Đã duyệt"
        : request.status === "denied"
          ? "Đã từ chối"
          : "Đang chờ duyệt";
    details.append(email, status);

    const actions = document.createElement("div");
    actions.className = "access-request-actions";
    if (request.status === "approved") {
      actions.append(createAccessActionButton("Thu hồi quyền", request.user_id, false));
    } else {
      actions.append(createAccessActionButton("Duyệt", request.user_id, true));
      if (request.status === "pending") {
        actions.append(createAccessActionButton("Từ chối", request.user_id, false));
      }
    }

    item.append(details, actions);
    accessRequestList.append(item);
  }

  accessAdminStatus.textContent = data?.length
    ? `Có ${data.length} yêu cầu hoặc tài khoản trong danh sách.`
    : "Chưa có yêu cầu sử dụng nào.";
}

function createAccessActionButton(label, userId, approved) {
  const button = document.createElement("button");
  button.className = "storage-button";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const { error } = await supabase.rpc("review_app_access_request", {
        target_user_id: userId,
        approved,
      });
      if (error) throw error;
      accessAdminStatus.textContent = approved ? "Đã cấp quyền sử dụng." : "Đã cập nhật quyền truy cập.";
      await loadAccessRequests();
    } catch (error) {
      accessAdminStatus.textContent =
        error instanceof Error ? error.message : "Không thể cập nhật quyền truy cập.";
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

async function refreshAppAccess() {
  if (!supabase || !currentUser) {
    isAccessApproved = false;
    isAccessAdmin = false;
    accessAdminPanel.hidden = true;
    showAccessGate(
      supabaseConfigured
        ? "Đăng nhập hoặc tạo tài khoản email, sau đó gửi yêu cầu để chủ ứng dụng phê duyệt."
        : "Ứng dụng cần được cấu hình Supabase để xác thực và duyệt tài khoản trước khi sử dụng.",
    );
    updateSyncControls();
    return;
  }

  const userId = currentUser.id;
  isAccessApproved = false;
  isAccessAdmin = false;
  accessAdminPanel.hidden = true;
  accessGateStatus.textContent = "Đang kiểm tra quyền truy cập…";
  showAccessGate("Đang kiểm tra quyền truy cập…");
  updateTelegramMainButton();

  try {
    const { data, error } = await supabase.rpc("get_app_access_state");
    if (error) throw error;
    if (currentUser?.id !== userId) return;

    isAccessAdmin = data?.is_admin === true;
    isAccessApproved = isAccessAdmin || data?.status === "approved";
    if (!isAccessApproved) {
      if (data?.status === "pending") {
        showAccessGate("Yêu cầu của bạn đang chờ chủ ứng dụng phê duyệt.");
      } else if (data?.status === "denied") {
        showAccessGate("Tài khoản chưa được cấp quyền. Bạn có thể gửi lại yêu cầu để được xem xét.", {
          canRequest: true,
          buttonText: "Gửi lại yêu cầu",
        });
      } else {
        showAccessGate("Tài khoản chưa có quyền sử dụng. Gửi yêu cầu để chủ ứng dụng phê duyệt.", {
          canRequest: true,
        });
      }
      accessGateStatus.textContent = `Đang đăng nhập: ${currentUser.email ?? ""}`;
      setSyncStatus("Bạn cần được chủ ứng dụng phê duyệt trước khi sử dụng công cụ.");
      updateSyncControls();
      return;
    }

    accessGate.hidden = true;
    studioLayout.hidden = false;
    accessAdminPanel.hidden = !isAccessAdmin;
    accessGateStatus.textContent = "";
    updateTelegramMainButton();
    updateSyncControls();
    if (isAccessAdmin) {
      loadAccessRequests().catch((error) => {
        accessAdminStatus.textContent =
          error instanceof Error ? error.message : "Không thể tải danh sách yêu cầu.";
      });
    }
    loadSavedProfiles().catch((error) =>
      setSyncStatus(error instanceof Error ? error.message : "Không thể tải dữ liệu.", true),
    );
  } catch (error) {
    if (currentUser?.id !== userId) return;
    isAccessApproved = false;
    isAccessAdmin = false;
    accessAdminPanel.hidden = true;
    showAccessGate("Không thể kiểm tra quyền truy cập. Vui lòng tải lại trang hoặc liên hệ chủ ứng dụng.");
    accessGateStatus.textContent = error instanceof Error ? error.message : "Lỗi kiểm tra quyền truy cập.";
    setSyncStatus("Không thể xác minh quyền truy cập. Công cụ đã được khóa để bảo vệ cổng phê duyệt.", true);
    updateSyncControls();
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
  posterQr.style.left = `${QR_POSITION.left * 100}%`;
  posterQr.style.top = `${QR_POSITION.top * 100}%`;
  posterQr.style.width = `${QR_POSITION.size * 100}%`;
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
  const userId = currentUser.id;
  const { data, error } = await supabase
    .from("transfer_profiles")
    .select("id,bank_bin,account_number,account_name,amount,description,is_default")
    .eq("user_id", currentUser.id)
    .order("is_default", { ascending: false })
    .order("account_name", { ascending: true });
  if (error) throw error;
  if (currentUser?.id !== userId || !isAccessApproved) return;
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
  if (!currentUser || !isAccessApproved || !supabase) return null;
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
  if (!isAccessApproved) throw new Error("Tài khoản chưa được phê duyệt sử dụng ứng dụng.");
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

requestAccessButton.addEventListener("click", async () => {
  if (!supabase || !currentUser) return;
  requestAccessButton.disabled = true;
  try {
    const { error } = await supabase.rpc("request_app_access");
    if (error) throw error;
    await refreshAppAccess();
  } catch (error) {
    accessGateStatus.textContent =
      error instanceof Error ? error.message : "Không thể gửi yêu cầu. Vui lòng thử lại.";
  } finally {
    requestAccessButton.disabled = false;
  }
});

refreshAccessRequestsButton.addEventListener("click", async () => {
  refreshAccessRequestsButton.disabled = true;
  try {
    await loadAccessRequests();
  } catch (error) {
    accessAdminStatus.textContent =
      error instanceof Error ? error.message : "Không thể tải danh sách yêu cầu.";
  } finally {
    refreshAccessRequestsButton.disabled = false;
  }
});

saveAccountButton.addEventListener("click", async () => {
  if (!currentUser || !isAccessApproved || !supabase) return;
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
  if (!isAccessApproved || !supabase) return;
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
  if (!currentUser || !isAccessApproved || !supabase) return;
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
      setSyncStatus("Đã mở bảng chia sẻ ảnh. Chọn Telegram, nhóm hoặc ứng dụng muốn gửi poster PNG.");
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

shareTelegramButton.addEventListener("click", () => {
  const appUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  const shareUrl = createTelegramShareUrl(appUrl);
  if (telegramApp?.openTelegramLink) {
    telegramApp.openTelegramLink(shareUrl);
  } else {
    const link = document.createElement("a");
    link.href = shareUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }
  setSyncStatus("Đã mở Telegram. Chọn nhóm hoặc cuộc trò chuyện rồi gửi liên kết ứng dụng.");
});

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    if (!currentUser) {
      isAccessApproved = false;
      isAccessAdmin = false;
      accessAdminPanel.hidden = true;
      accessAdminStatus.textContent = "";
      accessRequestList.replaceChildren();
      accessGateStatus.textContent = "";
      showAccessGate("Đăng nhập hoặc tạo tài khoản email, sau đó gửi yêu cầu để chủ ứng dụng phê duyệt.");
      savedProfiles = [];
      selectedProfileId = null;
      updateTelegramMainButton();
      renderSavedProfiles();
      setSyncStatus("Đăng nhập để lưu riêng tư và đồng bộ trên các thiết bị.");
      updateSyncControls();
      return;
    }
    const userId = currentUser.id;
    showAccessGate("Đang kiểm tra quyền truy cập…");
    setSyncStatus(`Đã đăng nhập: ${currentUser.email}. Đang kiểm tra quyền sử dụng…`);
    window.setTimeout(() => {
      if (currentUser?.id === userId) refreshAppAccess();
    }, 0);
  });
} else {
  showAccessGate("Ứng dụng cần được cấu hình Supabase để xác thực và duyệt tài khoản trước khi sử dụng.");
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
  posterQr.style.left = `${QR_POSITION.left * 100}%`;
  posterQr.style.top = `${QR_POSITION.top * 100}%`;
  posterQr.style.width = `${QR_POSITION.size * 100}%`;
  qrImage.src = qrDataUrl;
  qrImage.alt = `Mã VietQR chuyển khoản đến ${details.accountName}, ${details.bank.name}`;
  qrImage.hidden = false;
  qrPlaceholder.hidden = true;
  downloadButton.disabled = false;
  currentPosterData = { qrDataUrl };
  currentPosterBlob = null;
  updateTelegramMainButton();
  updateSyncControls();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAccessApproved) return;
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

async function createPosterPng({ qrDataUrl }) {
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
