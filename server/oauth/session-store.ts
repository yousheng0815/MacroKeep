import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import {
  FIRESTORE_HANDOFF_COLLECTION,
  FIRESTORE_SESSION_COLLECTION,
  requireEnv,
} from "./config.js";

/**
 * Vercel/dash env vars usually store the JSON on one line; `private_key` then contains
 * literal `\n` sequences instead of PEM newlines — Firebase rejects that unless normalized.
 */
function normalizeServiceAccountCredential(
  parsed: Record<string, unknown>,
): ServiceAccount {
  const pk = parsed.private_key;
  if (typeof pk !== "string" || pk.length === 0) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON must include a non-empty private_key",
    );
  }
  const normalized = pk.includes("\\n") ? pk.replace(/\\n/g, "\n") : pk;
  if (!normalized.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON private_key does not look like a PEM key (check quoting when pasting)",
    );
  }
  return {
    ...parsed,
    private_key: normalized,
  } as ServiceAccount;
}

function ensureApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const raw = requireEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON must be valid JSON (paste the full key file as one line)",
    );
  }
  const projectId = parsed.project_id;
  if (typeof projectId !== "string" || projectId.length === 0) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON must include project_id",
    );
  }
  const account = normalizeServiceAccountCredential(parsed);
  return initializeApp({
    credential: cert(account),
    projectId,
  });
}

/** Always the `(default)` Firestore database for this project. */
function ensureFirestore(): Firestore {
  return getFirestore(ensureApp());
}

export type StoredOAuthSession = {
  encryptedRefreshToken: string;
  googleSub: string;
  email: string | null;
  scope: string;
};

export async function saveOAuthSession(
  sessionId: string,
  data: StoredOAuthSession,
): Promise<void> {
  const db = ensureFirestore();
  await db.collection(FIRESTORE_SESSION_COLLECTION).doc(sessionId).set({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getOAuthSession(
  sessionId: string,
): Promise<StoredOAuthSession | null> {
  const db = ensureFirestore();
  const snap = await db.collection(FIRESTORE_SESSION_COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  const d = snap.data();
  if (
    !d ||
    typeof d.encryptedRefreshToken !== "string" ||
    typeof d.googleSub !== "string" ||
    typeof d.scope !== "string"
  ) {
    return null;
  }
  return {
    encryptedRefreshToken: d.encryptedRefreshToken,
    googleSub: d.googleSub,
    email: typeof d.email === "string" ? d.email : null,
    scope: d.scope,
  };
}

export async function deleteOAuthSession(sessionId: string): Promise<void> {
  const db = ensureFirestore();
  await db.collection(FIRESTORE_SESSION_COLLECTION).doc(sessionId).delete();
}

const HANDOFF_TTL_MS = 120_000;

export async function saveSessionHandoff(
  nonce: string,
  sessionId: string,
): Promise<void> {
  const db = ensureFirestore();
  await db.collection(FIRESTORE_HANDOFF_COLLECTION).doc(nonce).set({
    sessionId,
    expiresAt: Timestamp.fromMillis(Date.now() + HANDOFF_TTL_MS),
  });
}

/** Deletes handoff doc and returns session id if valid; otherwise null. */
export async function consumeSessionHandoff(
  nonce: string,
): Promise<string | null> {
  const trimmed = nonce.trim();
  if (!trimmed || trimmed.length > 128) return null;
  const db = ensureFirestore();
  const ref = db.collection(FIRESTORE_HANDOFF_COLLECTION).doc(trimmed);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const d = snap.data();
    const sessionId = typeof d?.sessionId === "string" ? d.sessionId : null;
    const exp = d?.expiresAt;
    tx.delete(ref);
    if (!sessionId) return null;
    if (exp instanceof Timestamp && exp.toMillis() < Date.now()) return null;
    return sessionId;
  });
}
