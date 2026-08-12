// Local biometric unlock via WebAuthn platform authenticator.
// We don't perform server-side attestation; we only verify that the user
// successfully passed a local platform authenticator challenge (Touch ID,
// Face ID, Windows Hello, Android biometric).

const CRED_KEY = "daftarak.biometric.credId";
const ENABLED_KEY = "daftarak.biometric";

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function biometricEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1" && !!localStorage.getItem(CRED_KEY);
  } catch {
    return false;
  }
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerBiometric(userId: string, userName: string): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "دفترك" },
      user: { id: userIdBytes, name: userName || userId, displayName: userName || "دفترك" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("لم يتم تسجيل البصمة");
  localStorage.setItem(CRED_KEY, b64encode(cred.rawId));
  localStorage.setItem(ENABLED_KEY, "1");
}

export function disableBiometric() {
  try {
    localStorage.removeItem(CRED_KEY);
    localStorage.setItem(ENABLED_KEY, "0");
  } catch {
    /* ignore */
  }
}

export async function verifyBiometric(): Promise<boolean> {
  const idB64 = localStorage.getItem(CRED_KEY);
  if (!idB64) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60_000,
        userVerification: "required",
        allowCredentials: [{ type: "public-key", id: b64decode(idB64).buffer as ArrayBuffer }],
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
