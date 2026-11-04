import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_QR_SLOT, normalizeQrSlot, validateTemplateFile, slotToStyle } from "./poster.js";

test("keeps a valid QR slot and falls back for invalid ones", () => {
  assert.deepEqual(normalizeQrSlot({ left: 0.2, top: 0.3, size: 0.4 }), { left: 0.2, top: 0.3, size: 0.4 });
  assert.deepEqual(normalizeQrSlot({ left: 0.9, top: 0.3, size: 0.4 }), DEFAULT_QR_SLOT);
  assert.deepEqual(normalizeQrSlot(null), DEFAULT_QR_SLOT);
});

test("only accepts reasonably sized PNG templates", () => {
  assert.equal(validateTemplateFile({ type: "image/png", size: 1000 }), null);
  assert.ok(validateTemplateFile({ type: "image/jpeg", size: 1000 }));
  assert.ok(validateTemplateFile({ type: "image/png", size: 9 * 1024 * 1024 }));
  assert.ok(validateTemplateFile(null));
});

test("converts a slot to percentage styles", () => {
  assert.deepEqual(slotToStyle({ left: 0.5, top: 0.25, size: 0.2 }), {
    left: "50%",
    top: "25%",
    width: "20%",
  });
});
