import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GUIDE_URL, normalizeGuideUrl } from "./guide-url.js";

test("the default QR destination is the official BHXH homepage", () => {
  assert.equal(normalizeGuideUrl(DEFAULT_GUIDE_URL), "https://baohiemxahoi.gov.vn/");
});

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
