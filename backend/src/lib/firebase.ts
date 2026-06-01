// ─── Firebase Token Verification ──────────────────────────────────────────────
// Verifies Firebase ID tokens using the Firebase Auth JWK endpoint

interface FirebaseTokenPayload {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  aud: string;
  exp: number;
  iat: number;
}

export async function verifyFirebaseToken(
  idToken: string,
  _serviceAccount: string,
): Promise<{ uid: string; email?: string; displayName?: string } | null> {
  try {
    // Decode JWT header to get key ID
    const [headerB64, payloadB64, signatureB64] = idToken.split('.');

    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'))) as { kid: string; alg: string };
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as FirebaseTokenPayload;

    // Verify expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Fetch Firebase public keys as JWKs and verify signature
    const jwkResp = await fetch(
      `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`,
    );
    if (!jwkResp.ok) return null;
    const jwkSet = await jwkResp.json() as { keys: (JsonWebKey & { kid: string })[] };
    const jwk = jwkSet.keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    );

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      new TextEncoder().encode(signingInput),
    );

    if (!isValid) return null;

    return {
      uid: payload.uid || (payload as Record<string, unknown>)['sub'] as string,
      email: payload.email,
      displayName: payload.name,
    };
  } catch (err) {
    console.error('[Firebase Verify]', err);
    return null;
  }
}
