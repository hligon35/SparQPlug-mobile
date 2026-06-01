const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveOrgKey(secretSeed: string, organizationId: string): Promise<CryptoKey> {
  const material = encoder.encode(`${secretSeed}:password-locker:${organizationId}`);
  const hash = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(
  plaintext: string,
  secretSeed: string,
  organizationId: string,
): Promise<{ encrypted: string; iv: string }> {
  const key = await deriveOrgKey(secretSeed, organizationId);
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    encoder.encode(plaintext),
  );

  return {
    encrypted: bytesToBase64(new Uint8Array(cipherBuffer)),
    iv: bytesToBase64(ivBytes),
  };
}

export async function decryptSecret(
  encrypted: string,
  iv: string,
  secretSeed: string,
  organizationId: string,
): Promise<string> {
  const key = await deriveOrgKey(secretSeed, organizationId);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(encrypted),
  );

  return decoder.decode(decrypted);
}
