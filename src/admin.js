import {
  matchesPosterAspectRatio,
  normalizeGuideUrl,
  validateQrPlacement,
} from "./guide-url.js";
import {
  defaultPosterPath,
  posterBucket,
  supabase,
  supabaseConfigurationError,
  supabaseConfigured,
} from "./supabase.js";
import "./admin.css";

const configNotice = document.querySelector("#config-notice");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const settingsPanel = document.querySelector("#settings-panel");
const settingsForm = document.querySelector("#settings-form");
const settingsMessage = document.querySelector("#settings-message");
const guideUrlInput = document.querySelector("#guide-url");
const templateFileInput = document.querySelector("#template-file");
const qrXInput = document.querySelector("#qr-x");
const qrYInput = document.querySelector("#qr-y");
const qrSizeInput = document.querySelector("#qr-size");
const templatePreview = document.querySelector("#template-preview");
const qrGuide = document.querySelector("#qr-guide");
const saveButton = document.querySelector("#save-button");

let currentSettings = null;
let dragOffset = null;
let previewObjectUrl = null;
let previewAspectRatio = 881 / 1280;

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.hidden = false;
  element.dataset.state = isError ? "error" : "success";
}

function setQrPosition(x, y, size) {
  qrGuide.style.left = `${x}%`;
  qrGuide.style.top = `${y}%`;
  qrGuide.style.width = `${size}%`;
  qrGuide.style.height = `${size * previewAspectRatio}%`;
}

function updatePreviewPosition() {
  const x = Number(qrXInput.value);
  const y = Number(qrYInput.value);
  const size = Number(qrSizeInput.value);
  setQrPosition(x, y, size);
}

function setSettingsForm(settings) {
  currentSettings = settings;
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  guideUrlInput.value = settings.destination_url ?? "";
  qrXInput.value = String(settings.qr_x_percent ?? 33);
  qrYInput.value = String(settings.qr_y_percent ?? 43);
  qrSizeInput.value = String(settings.qr_size_percent ?? 34);
  templatePreview.crossOrigin = settings.poster_url?.startsWith("http") ? "anonymous" : "";
  templatePreview.src = settings.poster_url || defaultPosterPath;
  updatePreviewPosition();
}

async function loadAdminSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("destination_url,poster_url,qr_x_percent,qr_y_percent,qr_size_percent")
    .eq("id", "default")
    .single();
  if (error) throw new Error(`Không tải được cấu hình: ${error.message}`);
  setSettingsForm(data);
}

async function showSettingsForUser(user) {
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) throw new Error(`Không xác minh được quyền admin: ${error.message}`);
  if (!isAdmin) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw new Error(`Không thể kết thúc phiên đăng nhập: ${signOutError.message}`);
    throw new Error(`Tài khoản ${user.email ?? ""} chưa được cấp quyền quản trị.`);
  }
  await loadAdminSettings();
  loginForm.hidden = true;
  settingsPanel.hidden = false;
}

for (const input of [qrXInput, qrYInput, qrSizeInput]) {
  input.addEventListener("input", updatePreviewPosition);
}

templateFileInput.addEventListener("change", () => {
  const file = templateFileInput.files?.[0];
  if (!file) return;
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  templatePreview.crossOrigin = "";
  templatePreview.src = previewObjectUrl;
});

templatePreview.addEventListener("load", () => {
  if (!templatePreview.naturalWidth || !templatePreview.naturalHeight) return;
  previewAspectRatio = templatePreview.naturalWidth / templatePreview.naturalHeight;
  document.querySelector(".editor-canvas").style.aspectRatio =
    `${templatePreview.naturalWidth} / ${templatePreview.naturalHeight}`;
  updatePreviewPosition();
});

qrGuide.addEventListener("pointerdown", (event) => {
  const rect = templatePreview.getBoundingClientRect();
  const guideRect = qrGuide.getBoundingClientRect();
  dragOffset = {
    x: event.clientX - guideRect.left,
    y: event.clientY - guideRect.top,
    rect,
  };
  qrGuide.setPointerCapture(event.pointerId);
});

qrGuide.addEventListener("pointermove", (event) => {
  if (!dragOffset) return;
  const { rect } = dragOffset;
  const size = Number(qrSizeInput.value);
  const nextX = Math.min(
    100 - size,
    Math.max(0, ((event.clientX - dragOffset.x - rect.left) / rect.width) * 100),
  );
  const nextY = Math.min(
    100 - size * previewAspectRatio,
    Math.max(0, ((event.clientY - dragOffset.y - rect.top) / rect.height) * 100),
  );
  qrXInput.value = nextX.toFixed(1);
  qrYInput.value = nextY.toFixed(1);
  updatePreviewPosition();
});

qrGuide.addEventListener("pointerup", () => {
  dragOffset = null;
});

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.hidden = true;
  const formData = new FormData(loginForm);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    if (error) throw error;
    await showSettingsForUser(data.user);
  } catch (error) {
    showMessage(
      loginMessage,
      error instanceof Error ? error.message : "Đăng nhập không thành công.",
      true,
    );
  }
});

document.querySelector("#signout-button").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showMessage(settingsMessage, `Đăng xuất không thành công: ${error.message}`, true);
    return;
  }
  settingsPanel.hidden = true;
  loginForm.hidden = false;
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  settingsMessage.hidden = true;
  saveButton.disabled = true;
  saveButton.textContent = "Đang lưu…";

  try {
    const destinationUrl = normalizeGuideUrl(guideUrlInput.value);
    const qrX = Number(qrXInput.value);
    const qrY = Number(qrYInput.value);
    const qrSize = Number(qrSizeInput.value);
    validateQrPlacement(qrX, qrY, qrSize);

    let posterUrl = currentSettings.poster_url || defaultPosterPath;
    const file = templateFileInput.files?.[0];
    if (file) {
      const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
      if (!allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) {
        throw new Error("Chọn ảnh PNG, JPG hoặc WebP có dung lượng tối đa 10 MB.");
      }
      const previewImage = new Image();
      const previewUrl = URL.createObjectURL(file);
      try {
        previewImage.src = previewUrl;
        await new Promise((resolve, reject) => {
          previewImage.onload = resolve;
          previewImage.onerror = () => reject(new Error("Không đọc được ảnh poster."));
        });
      } finally {
        URL.revokeObjectURL(previewUrl);
      }
      if (!matchesPosterAspectRatio(previewImage.naturalWidth, previewImage.naturalHeight)) {
        throw new Error("Ảnh poster cần giữ tỉ lệ dọc 881:1280 để QR khớp đúng vị trí.");
      }
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `templates/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(posterBucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(`Không tải được ảnh lên: ${uploadError.message}`);
      posterUrl = supabase.storage.from(posterBucket).getPublicUrl(path).data.publicUrl;
    }

    const { data, error } = await supabase
      .from("site_settings")
      .update({
        destination_url: destinationUrl,
        poster_url: posterUrl,
        qr_x_percent: qrX,
        qr_y_percent: qrY,
        qr_size_percent: qrSize,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default")
      .select("destination_url,poster_url,qr_x_percent,qr_y_percent,qr_size_percent")
      .single();
    if (error) throw new Error(`Không lưu được cấu hình: ${error.message}`);

    setSettingsForm(data);
    templateFileInput.value = "";
    showMessage(settingsMessage, "Đã lưu poster và cấu hình QR cho trang khách.");
  } catch (error) {
    showMessage(
      settingsMessage,
      error instanceof Error ? error.message : "Không lưu được cấu hình.",
      true,
    );
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Lưu cấu hình";
  }
});

if (!supabaseConfigured) {
  if (supabaseConfigurationError) configNotice.textContent = supabaseConfigurationError;
  configNotice.hidden = false;
} else {
  supabase.auth.getSession().then(async ({ data, error }) => {
    if (error) {
      configNotice.textContent = `Không kiểm tra được phiên đăng nhập: ${error.message}`;
      configNotice.hidden = false;
      return;
    }
    if (!data.session) {
      loginForm.hidden = false;
      return;
    }
    try {
      await showSettingsForUser(data.session.user);
    } catch (authError) {
      configNotice.textContent =
        authError instanceof Error ? authError.message : "Không xác minh được quyền quản trị.";
      configNotice.hidden = false;
      loginForm.hidden = false;
    }
  });
}
