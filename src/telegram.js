const TELEGRAM_HEX_COLOR = /^#[\da-f]{6}$/i;

export function createTelegramShareUrl(appUrl, text = "Mở VietQR Studio để tạo mã QR chuyển khoản.") {
  const shareUrl = new URL("https://t.me/share/url");
  shareUrl.searchParams.set("url", appUrl);
  shareUrl.searchParams.set("text", text);
  return shareUrl.href;
}

export function initializeTelegramMiniApp(
  webApp = globalThis.Telegram?.WebApp,
  root = globalThis.document?.documentElement,
  viewport = globalThis.window,
) {
  if (!webApp) return null;

  webApp.ready?.();
  webApp.expand?.();

  const updateViewport = () => {
    const height =
      webApp.viewportStableHeight > 0
        ? webApp.viewportStableHeight
        : webApp.viewportHeight > 0
          ? webApp.viewportHeight
          : viewport?.innerHeight;
    if (Number.isFinite(height) && height > 0) {
      root?.style?.setProperty("--tg-viewport-height", `${height}px`);
    }
  };

  const updateTheme = () => {
    const backgroundColor = webApp.themeParams?.bg_color;
    if (!TELEGRAM_HEX_COLOR.test(backgroundColor ?? "")) return;
    root?.style?.setProperty("--tg-background-color", backgroundColor);
    const themeColorMeta = root?.querySelector?.('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.content = backgroundColor;
  };

  updateViewport();
  updateTheme();
  webApp.onEvent?.("viewportChanged", updateViewport);
  webApp.onEvent?.("themeChanged", updateTheme);
  return webApp;
}
