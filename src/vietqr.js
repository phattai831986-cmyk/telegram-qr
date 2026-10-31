const utf8 = new TextEncoder();

function byteLength(value) {
  return utf8.encode(value).length;
}

function field(id, value) {
  const length = byteLength(value);
  if (length > 99) {
    throw new Error("Nội dung QR quá dài.");
  }
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

export function crc16(text) {
  let crc = 0xffff;
  for (const byte of utf8.encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function createVietQrPayload({ bank, accountNumber, accountName, amount, description }) {
  const bankAccount = [
    field("00", bank.bin),
    field("01", accountNumber),
    field("02", "QRIBFTTA"),
  ].join("");
  const merchantAccount = [field("00", "A000000727"), field("01", bankAccount)].join("");
  const additionalData = description ? field("62", field("08", description)) : "";

  let payload = [
    field("00", "01"),
    field("01", "12"),
    field("38", merchantAccount),
    field("53", "704"),
  ];
  if (amount) payload.push(field("54", amount));
  payload.push(field("58", "VN"));
  payload.push(field("59", accountName));
  if (additionalData) payload.push(additionalData);
  payload.push("6304");

  const withoutCrc = payload.join("");
  return `${withoutCrc}${crc16(withoutCrc)}`;
}

export function formatVnd(value) {
  if (!value) return "";
  const formatted = new Intl.NumberFormat("vi-VN").format(Number(value)).replace(/[\u00a0\u202f]/g, " ");
  return `${formatted} ₫`;
}
