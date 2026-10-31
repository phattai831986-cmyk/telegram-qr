import test from "node:test";
import assert from "node:assert/strict";
import { initializeTelegramMiniApp } from "./telegram.js";

function createRoot() {
  const properties = new Map();
  const themeColorMeta = { content: "#f3f7f4" };
  return {
    properties,
    themeColorMeta,
    style: {
      setProperty(name, value) {
        properties.set(name, value);
      },
    },
    querySelector(selector) {
      return selector === 'meta[name="theme-color"]' ? themeColorMeta : null;
    },
  };
}

test("does nothing when opened outside Telegram", () => {
  assert.equal(initializeTelegramMiniApp(null, createRoot(), { innerHeight: 700 }), null);
});

test("initializes Telegram and tracks stable viewport height", () => {
  const root = createRoot();
  const callbacks = new Map();
  const calls = [];
  const webApp = {
    viewportStableHeight: 640,
    ready: () => calls.push("ready"),
    expand: () => calls.push("expand"),
    onEvent: (event, callback) => callbacks.set(event, callback),
  };

  assert.equal(initializeTelegramMiniApp(webApp, root, { innerHeight: 700 }), webApp);
  assert.deepEqual(calls, ["ready", "expand"]);
  assert.equal(root.properties.get("--tg-viewport-height"), "640px");

  webApp.viewportStableHeight = 680;
  callbacks.get("viewportChanged")();
  assert.equal(root.properties.get("--tg-viewport-height"), "680px");
});

test("applies Telegram background theme changes", () => {
  const root = createRoot();
  const callbacks = new Map();
  const webApp = {
    themeParams: { bg_color: "#202020" },
    onEvent: (event, callback) => callbacks.set(event, callback),
  };

  initializeTelegramMiniApp(webApp, root, { innerHeight: 700 });
  assert.equal(root.properties.get("--tg-background-color"), "#202020");
  assert.equal(root.themeColorMeta.content, "#202020");

  webApp.themeParams.bg_color = "invalid";
  callbacks.get("themeChanged")();
  assert.equal(root.properties.get("--tg-background-color"), "#202020");
  assert.equal(root.themeColorMeta.content, "#202020");
});
