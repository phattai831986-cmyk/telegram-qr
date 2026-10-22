import test from "node:test";
import assert from "node:assert/strict";
import { crc16, createVietQrPayload, formatVnd } from "./vietqr.js";

const transfer = {
  bank: { name: "Example Bank", bin: "970436" },
  accountNumber: "1234567890",
  accountName: "NGUYEN VAN A",
  amount: "125000",
  description: "Thanh toan",
};

test("uses the standard CRC-16/CCITT-FALSE checksum", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("creates a VietQR transfer payload with bank account, amount, and description", () => {
  const payload = createVietQrPayload(transfer);
  assert.match(payload, /^000201010212/);
  assert.ok(payload.includes("A000000727"));
  assert.ok(payload.includes("970436"));
  assert.ok(payload.includes("QRIBFTTA"));
  assert.ok(payload.includes("5406125000"));
  assert.ok(payload.includes("Thanh toan"));
  assert.match(payload, /6304[0-9A-F]{4}$/);
  assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)));
});

test("omits optional amount and transfer description when not provided", () => {
  const payload = createVietQrPayload({ ...transfer, amount: "", description: "" });
  assert.ok(!payload.includes("540"));
  assert.ok(!payload.includes("62"));
  assert.match(payload, /6304[0-9A-F]{4}$/);
});

test("formats VND amounts with Vietnamese locale", () => {
  assert.equal(formatVnd("125000"), "125.000 ₫");
  assert.equal(formatVnd(""), "");
});
