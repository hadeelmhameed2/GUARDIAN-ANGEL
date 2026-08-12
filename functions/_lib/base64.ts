export function stripDataUrlPrefix(value: string): { base64: string; contentType: string | null } {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { base64: value, contentType: null };
  }
  return { base64: match[2], contentType: match[1] };
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function toVisionDataUrl(base64OrDataUrl: string, contentType: string): string {
  if (base64OrDataUrl.startsWith("data:")) return base64OrDataUrl;
  return `data:${contentType};base64,${base64OrDataUrl}`;
}
