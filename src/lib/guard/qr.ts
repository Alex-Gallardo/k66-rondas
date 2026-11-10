export function parseQrCode(value: string): string | null {
  const text = value.trim();
  if (isValidQrCode(text)) return text;
  try {
    const url = new URL(text);
    const match = /^\/scan\/([0-9a-f]{32}|[0-9A-F]{16})\/?$/.exec(url.pathname);
    return url.protocol === "https:" ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1"
      ? (match?.[1] ?? null)
      : null;
  } catch {
    return null;
  }
}

export function isValidQrCode(value: string): boolean {
  return /^(?:[0-9a-f]{32}|[0-9A-F]{16})$/.test(value);
}
