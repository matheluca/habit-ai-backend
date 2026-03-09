import { jwtVerify, createRemoteJWKSet } from 'jose';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const FIREBASE_PROJECT_ID = 'kangal-habit';

let jwks: ReturnType<typeof createRemoteJWKSet>;

function initializeJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }
  return jwks;
}

export interface FirebaseToken {
  uid: string;
  email: string;
  iat: number;
}

export async function validateFirebaseToken(token: string): Promise<FirebaseToken> {
  try {
    const jwksSet = initializeJWKS();

    const verified = await jwtVerify(token, jwksSet, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    const payload = verified.payload;

    const uid = payload.sub as string;
    const email = (payload.email as string) || '';
    const iat = Math.floor((payload.iat || 0));

    if (!uid) {
      throw new Error('UID não encontrado no token');
    }

    return { uid, email, iat };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token inválido';
    throw new Error(`JWT validation failed: ${message}`);
  }
}

export async function validateFirebaseTokenSafe(token: string): Promise<FirebaseToken | null> {
  try {
    return await validateFirebaseToken(token);
  } catch (error) {
    console.error('[JWT] Validation error:', error);
    return null;
  }
}
