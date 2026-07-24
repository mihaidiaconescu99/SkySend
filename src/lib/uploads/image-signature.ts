const heicBrands = new Set(["heic", "heix", "hevc", "hevx"]);
const heifBrands = new Set(["mif1", "msf1"]);

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function detectImageContentType(bytes: Uint8Array) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg" as const;
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 4) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png" as const;
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return "image/webp" as const;
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (heicBrands.has(brand)) return "image/heic" as const;
    if (heifBrands.has(brand)) return "image/heif" as const;
  }
  return null;
}

export function imageSignatureMatches(
  bytes: Uint8Array,
  declaredContentType: string,
) {
  const detected = detectImageContentType(bytes);
  if (!detected) return false;
  if (
    (declaredContentType === "image/heic" ||
      declaredContentType === "image/heif") &&
    (detected === "image/heic" || detected === "image/heif")
  ) {
    return true;
  }
  return detected === declaredContentType;
}
