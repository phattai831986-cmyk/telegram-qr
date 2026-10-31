import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesPosterAspectRatio,
  normalizeGuideUrl,
  validateQrPlacement,
} from "./guide-url.js";

test("accepts HTTPS pages on official BHXH/VssID domains", () => {
  assert.equal(
    normalizeGuideUrl("https://baohiemxahoi.gov.vn/huong-dan"),
    "https://baohiemxahoi.gov.vn/huong-dan",
  );
  assert.equal(normalizeGuideUrl("https://portal.vssid.gov.vn/"), "https://portal.vssid.gov.vn/");
});

test("rejects insecure, unrelated, or credential-bearing URLs", () => {
  for (const url of [
    "http://baohiemxahoi.gov.vn/",
    "https://example.com/",
    "https://baohiemxahoi.gov.vn.example.com/",
    "https://user@baohiemxahoi.gov.vn/",
  ]) {
    assert.throws(() => normalizeGuideUrl(url));
  }
});

test("accepts QR placement inside the poster and rejects out-of-bounds placement", () => {
  assert.doesNotThrow(() => validateQrPlacement(33, 43, 34));
  assert.throws(() => validateQrPlacement(80, 43, 34));
  assert.throws(() => validateQrPlacement(33, 80, 34));
  assert.throws(() => validateQrPlacement(33, 43, 0));
});

test("requires uploaded posters to match the QR canvas proportions", () => {
  assert.equal(matchesPosterAspectRatio(881, 1280), true);
  assert.equal(matchesPosterAspectRatio(881, 881), false);
});
