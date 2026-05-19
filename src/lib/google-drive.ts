import {
  ageYearsFromIsoBirthDate,
  isValidIsoBirthDate,
} from "@/lib/birth-date";
import { blobToBase64 } from "@/lib/file-to-base64";
import {
  clearProgressPhotosIndexedDb,
  listProgressPhotosDesc,
} from "@/lib/progress-photos-db";
import type {
  MealRecord,
  OnboardingDraft,
  RecordsCoreDocument,
  RecordsDocument,
  SavedMealRecord,
  UserProfile,
} from "@/types/records";
import { isAppLocale } from "@/i18n/config";
import { emptyRecords } from "@/types/records";
import type {
  ProgressPhotoDriveMeta,
  ProgressPhotoRecord,
  ProgressPhotosPullResult,
} from "@/types/progress-photos";

/** Drive App Data JSON: profile, macro targets, optional Gemini BYOK key (no meal rows). */
export const CORE_DRIVE_FILE = "core.json";

/** Index of body progress shots; JPEG files named `progress-photo-<id>.jpg` in the same folder. */
export const PROGRESS_PHOTOS_MANIFEST_FILE = "progress-photos.json";

/** Quick-add meal snapshots (not tied to `meals-YYYY-MM.json` rows). */
export const SAVED_MEALS_DRIVE_FILE = "saved-meals.json";

const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files";

const MEALS_SHARD_RE = /^meals-(\d{4}-\d{2})\.json$/;

export function monthKeyFromRecordedAt(recordedAtIso: string): string {
  const d = new Date(recordedAtIso);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth() + 1;
    return `${y}-${String(mo).padStart(2, "0")}`;
  }
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

function mealsShardFileName(monthKey: string): string {
  return `meals-${monthKey}.json`;
}

function normalizeMeal(row: Partial<MealRecord> | null | undefined): MealRecord | null {
  if (!row || typeof row !== "object") return null;
  const id =
    typeof row.id === "string"
      ? row.id
      : row.id != null
        ? String(row.id)
        : "";
  if (!id) return null;
  const rawName = typeof row.food_name === "string" ? row.food_name.trim() : "";
  const food_name = rawName.length > 0 ? rawName : "Meal";
  const calories = Number(row.calories);
  const protein = Number(row.protein);
  const fats = Number(row.fats);
  const carbs = Number(row.carbs);
  const recordedAt =
    typeof row.recordedAt === "string" ? row.recordedAt : new Date().toISOString();
  const photoFileId =
    typeof row.photoFileId === "string" && row.photoFileId.trim().length > 0
      ? row.photoFileId.trim()
      : undefined;
  const meal: MealRecord = {
    id,
    food_name,
    calories: Number.isFinite(calories) ? calories : 0,
    protein: Number.isFinite(protein) ? protein : 0,
    fats: Number.isFinite(fats) ? fats : 0,
    carbs: Number.isFinite(carbs) ? carbs : 0,
    recordedAt,
  };
  if (photoFileId) meal.photoFileId = photoFileId;
  return meal;
}

function extensionForMime(mimeType: string): string {
  const m = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return "jpg";
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function normalizeOnboardingDraft(
  draft: Partial<OnboardingDraft> | null | undefined,
): OnboardingDraft | undefined {
  if (!draft || typeof draft !== "object") return undefined;
  const d = draft as Record<string, unknown>;
  const birthDateRaw =
    typeof draft.birthDate === "string" ? draft.birthDate.trim() : "";
  if (!isValidIsoBirthDate(birthDateRaw)) return undefined;
  const age = ageYearsFromIsoBirthDate(birthDateRaw);
  const unitsPreference =
    draft.unitsPreference === "imperial" ? "imperial" : "metric";
  const rawH = Number(d.height);
  const rawW = Number(d.weight);
  if (
    !Number.isFinite(rawH) ||
    !Number.isFinite(rawW) ||
    rawH <= 0 ||
    rawW <= 0
  ) {
    return undefined;
  }
  const height = Math.max(1, Math.round(rawH));
  const weight = Math.max(1, Math.round(rawW));
  const suggestedDailyTargetKcal = Number(draft.suggestedDailyTargetKcal);
  const suggestedProteinTargetG = Number(draft.suggestedProteinTargetG);
  const suggestedFatsTargetG = Number(draft.suggestedFatsTargetG);
  const suggestedCarbsTargetG = Number(draft.suggestedCarbsTargetG);
  const goal = draft.goal;
  const activityLevel = draft.activityLevel;
  const gender = draft.gender;
  if (
    !Number.isFinite(age) ||
    (gender !== "male" && gender !== "female") ||
    !Number.isFinite(suggestedDailyTargetKcal) ||
    !Number.isFinite(suggestedProteinTargetG) ||
    !Number.isFinite(suggestedFatsTargetG) ||
    !Number.isFinite(suggestedCarbsTargetG) ||
    (goal !== "lose_weight" &&
      goal !== "maintain_weight" &&
      goal !== "gain_muscle" &&
      goal !== "improve_health") ||
    (activityLevel !== "sedentary" &&
      activityLevel !== "light" &&
      activityLevel !== "moderate" &&
      activityLevel !== "active" &&
      activityLevel !== "very_active")
  ) {
    return undefined;
  }
  return {
    birthDate: birthDateRaw,
    age: Math.max(1, Math.round(age)),
    gender,
    unitsPreference,
    height,
    weight,
    goal,
    activityLevel,
    suggestedDailyTargetKcal: Math.max(0, Math.round(suggestedDailyTargetKcal)),
    suggestedProteinTargetG: Math.max(0, Math.round(suggestedProteinTargetG)),
    suggestedFatsTargetG: Math.max(0, Math.round(suggestedFatsTargetG)),
    suggestedCarbsTargetG: Math.max(0, Math.round(suggestedCarbsTargetG)),
    suggestedAt:
      typeof draft.suggestedAt === "string" && draft.suggestedAt.trim().length > 0
        ? draft.suggestedAt
        : new Date().toISOString(),
  };
}

function normalizeUserProfile(
  partial: Partial<UserProfile> | null | undefined,
  defaults: UserProfile,
): UserProfile {
  const p = (partial && typeof partial === "object" ? partial : {}) as Record<
    string,
    unknown
  >;
  const raw = typeof p.birthDate === "string" ? p.birthDate.trim() : "";
  const birthDate = isValidIsoBirthDate(raw) ? raw : defaults.birthDate;
  const gender =
    p.gender === "male" || p.gender === "female" ? p.gender : defaults.gender;
  const unitsPreference =
    p.unitsPreference === "imperial" ? "imperial" : "metric";
  const rawH = Number(p.height);
  const rawW = Number(p.weight);
  const height =
    Number.isFinite(rawH) && rawH > 0
      ? Math.max(1, Math.round(rawH))
      : defaults.height;
  const weight =
    Number.isFinite(rawW) && rawW > 0
      ? Math.max(1, Math.round(rawW))
      : defaults.weight;
  const dailyTargetKcal = Number(p.dailyTargetKcal);
  const proteinTargetG = Number(p.proteinTargetG);
  const fatsTargetG = Number(p.fatsTargetG);
  const carbsTargetG = Number(p.carbsTargetG);
  return {
    birthDate,
    gender,
    unitsPreference,
    height,
    weight,
    dailyTargetKcal:
      Number.isFinite(dailyTargetKcal) && dailyTargetKcal >= 0
        ? Math.round(dailyTargetKcal)
        : defaults.dailyTargetKcal,
    proteinTargetG:
      Number.isFinite(proteinTargetG) && proteinTargetG >= 0
        ? Math.round(proteinTargetG)
        : defaults.proteinTargetG,
    fatsTargetG:
      Number.isFinite(fatsTargetG) && fatsTargetG >= 0
        ? Math.round(fatsTargetG)
        : defaults.fatsTargetG,
    carbsTargetG:
      Number.isFinite(carbsTargetG) && carbsTargetG >= 0
        ? Math.round(carbsTargetG)
        : defaults.carbsTargetG,
  };
}

export function normalizeRecordsCoreDocument(
  parsed: Partial<RecordsCoreDocument> | null | undefined,
): RecordsCoreDocument {
  const empty = emptyRecords();
  if (!parsed || typeof parsed !== "object") {
    return {
      version: empty.version,
      profile: { ...empty.profile },
    };
  }
  const gemini =
    typeof parsed.geminiApiKey === "string" && parsed.geminiApiKey.trim().length > 0
      ? parsed.geminiApiKey.trim()
      : undefined;
  const onboardingDraft = normalizeOnboardingDraft(parsed.onboardingDraft);
  const locale =
    typeof parsed.locale === "string" && isAppLocale(parsed.locale)
      ? parsed.locale
      : undefined;
  return {
    version: typeof parsed.version === "number" ? parsed.version : empty.version,
    profile: normalizeUserProfile(parsed.profile, empty.profile),
    ...(gemini !== undefined ? { geminiApiKey: gemini } : {}),
    ...(parsed.onboardingCompleted === true ? { onboardingCompleted: true } : {}),
    ...(onboardingDraft ? { onboardingDraft } : {}),
    ...(locale !== undefined ? { locale } : {}),
  };
}

export function normalizeRecordsDocument(
  parsed: Partial<RecordsDocument> | null | undefined,
): RecordsDocument {
  const core = normalizeRecordsCoreDocument(parsed);
  const meals = Array.isArray(parsed?.meals)
    ? (parsed.meals
        .map((r) => normalizeMeal(r as Partial<MealRecord>))
        .filter(Boolean) as MealRecord[])
    : [];
  return { ...core, meals };
}

function normalizeMealsShardPayload(parsed: unknown): MealRecord[] {
  if (!parsed || typeof parsed !== "object") return [];
  const meals = (parsed as { meals?: unknown }).meals;
  if (!Array.isArray(meals)) return [];
  return meals
    .map((r) => normalizeMeal(r as Partial<MealRecord>))
    .filter(Boolean) as MealRecord[];
}

/** One JSON file under the app's hidden Drive App Data folder. */
export type AppDataDriveFileListItem = {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
};

/**
 * Lists all non-trashed files in `appDataFolder` (paginated).
 * Requires OAuth scope `drive.appdata`.
 */
export async function listAllAppDataFiles(
  token: string,
  signal?: AbortSignal,
): Promise<AppDataDriveFileListItem[]> {
  const out: AppDataDriveFileListItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      spaces: "appDataFolder",
      q: "trashed=false",
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${DRIVE_FILES}?${params.toString()}`;
    const res = await fetch(url, { headers: authHeaders(token), signal });
    if (!res.ok) throw new Error(`Drive list app data failed: ${res.status}`);
    const data = (await res.json()) as {
      nextPageToken?: string;
      files?: AppDataDriveFileListItem[];
    };
    for (const f of data.files ?? []) {
      if (f?.id && f?.name) out.push(f);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  out.sort((a, b) => {
    const ta = a.modifiedTime ? Date.parse(a.modifiedTime) : 0;
    const tb = b.modifiedTime ? Date.parse(b.modifiedTime) : 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name);
  });
  return out;
}

/** True when the file is treated as JSON for in-app preview (name or MIME). */
export function isJsonAppDataFile(f: AppDataDriveFileListItem): boolean {
  const mime = (f.mimeType ?? "").toLowerCase();
  return mime.includes("json") || f.name.toLowerCase().endsWith(".json");
}

/** True when the file can be shown as an image preview (`alt=media` blob). */
export function isImagePreviewAppDataFile(f: AppDataDriveFileListItem): boolean {
  const mime = (f.mimeType ?? "").toLowerCase();
  return mime.startsWith("image/");
}

/**
 * Downloads a file from `appDataFolder` as UTF-8 text (`alt=media`).
 * Caller should ensure `fileId` belongs to the user's app data folder.
 */
export async function downloadAppDataFileText(
  token: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, { headers: authHeaders(token), signal });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.text();
}

function sniffImageMimeFromMagic(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf);
  if (b.byteLength >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (
    b.byteLength >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  )
    return "image/png";
  if (b.byteLength >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif";
  if (
    b.byteLength >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

function blobFromDriveMediaBuffer(buf: ArrayBuffer, contentTypeHeader: string | null): Blob {
  const rawCt = contentTypeHeader ?? "";
  const ct = rawCt ? rawCt.split(";")[0].trim().toLowerCase() : "";
  const magicMime = sniffImageMimeFromMagic(buf);
  let type = ct;
  if (!type.startsWith("image/")) {
    if (magicMime) type = magicMime;
    else if (!type) type = "application/octet-stream";
  }
  return new Blob([buf], { type });
}

function bufferLooksLikeImageMagic(buf: ArrayBuffer): boolean {
  return sniffImageMimeFromMagic(buf) !== null;
}

/** Drive v3 often returns 403 for `?access_token=`; prefer Bearer + redirect follow (Location is signed). */
function downloadDriveMediaWithXhr(
  token: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<{ buf: ArrayBuffer; contentType: string | null }> {
  return new Promise((resolve, reject) => {
    const url = `${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`;
    const xhr = new XMLHttpRequest();

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.open("GET", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "arraybuffer";

    xhr.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          buf: xhr.response as ArrayBuffer,
          contentType: xhr.getResponseHeader("Content-Type"),
        });
      } else {
        reject(new Error(`Drive download failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Drive download network error"));
    };

    xhr.send();
  });
}

/**
 * Downloads raw bytes from `appDataFolder` (`alt=media`).
 * Caller should ensure `fileId` belongs to the user's app data folder.
 *
 * Uses `Authorization: Bearer` only (`access_token` query returns 403 for Drive v3 in browsers).
 * Redirects are followed to a signed URL; if `fetch` still yields non-image bytes, retries via XHR.
 */
export async function downloadAppDataFileBlob(
  token: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const url = `${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`;

  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(token),
    credentials: "omit",
    redirect: "follow",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Drive download failed: ${res.status}`);
  }
  let buf = await res.arrayBuffer();
  let ct = res.headers.get("content-type");

  const jsonProbe = new Uint8Array(buf.slice(0, Math.min(buf.byteLength, 400)));
  const textHead = new TextDecoder().decode(jsonProbe);
  if (textHead.trimStart().startsWith("{") && textHead.includes('"error"')) {
    throw new Error("Drive returned an error JSON body instead of image bytes.");
  }

  if (!bufferLooksLikeImageMagic(buf)) {
    const xhrRes = await downloadDriveMediaWithXhr(token, fileId, signal);
    buf = xhrRes.buf;
    ct = xhrRes.contentType;
  }

  if (!bufferLooksLikeImageMagic(buf)) {
    throw new Error(
      "Drive download did not return a recognizable image (check file id and OAuth scope).",
    );
  }

  return blobFromDriveMediaBuffer(buf, ct);
}

async function findAppDataJsonFileIdByName(
  token: string,
  fileName: string,
): Promise<string | null> {
  const q = encodeURIComponent(`name='${fileName}' and trashed=false`);
  const url = `${DRIVE_FILES}?spaces=appDataFolder&q=${q}&fields=files(id,name)`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

async function downloadCoreRecords(
  token: string,
  fileId: string,
): Promise<RecordsCoreDocument> {
  const url = `${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as Partial<RecordsCoreDocument>;
    return normalizeRecordsCoreDocument(parsed);
  } catch {
    return normalizeRecordsCoreDocument(null);
  }
}

async function createMultipartJsonAppData(
  token: string,
  fileName: string,
  jsonBody: string,
): Promise<string> {
  const boundary = `boundary_${crypto.randomUUID?.() ?? String(Date.now())}`;
  const partBreak = `\r\n--${boundary}\r\n`;
  const close = `\r\n--${boundary}--`;

  const metadata = JSON.stringify({
    name: fileName,
    parents: ["appDataFolder"],
  });

  const multipartBody =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    metadata +
    partBreak +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    jsonBody +
    close;

  const url = `${UPLOAD_BASE}?uploadType=multipart`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Drive create missing id");
  return data.id;
}

async function updateJsonMedia(
  token: string,
  fileId: string,
  body: string,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${UPLOAD_BASE}/${encodeURIComponent(fileId)}?uploadType=media`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json; charset=UTF-8",
    },
    body,
    signal,
  });
  if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
}

/**
 * Overwrites a file in `appDataFolder` with the given UTF-8 text (media upload).
 * Caller should ensure `fileId` belongs to the user's app data folder.
 */
export async function updateAppDataFileText(
  token: string,
  fileId: string,
  body: string,
  signal?: AbortSignal,
): Promise<void> {
  await updateJsonMedia(token, fileId, body, signal);
}

export async function upsertCoreRecordsToDrive(
  token: string,
  core: RecordsCoreDocument,
): Promise<void> {
  const normalized = normalizeRecordsCoreDocument(core);
  const payload = JSON.stringify(normalized);
  const primaryId = await findAppDataJsonFileIdByName(token, CORE_DRIVE_FILE);
  if (primaryId) {
    await updateJsonMedia(token, primaryId, payload);
    return;
  }
  await createMultipartJsonAppData(token, CORE_DRIVE_FILE, payload);
}

async function findMealsShardFileId(
  token: string,
  monthKey: string,
): Promise<string | null> {
  const name = mealsShardFileName(monthKey);
  const q = encodeURIComponent(`name='${name}' and trashed=false`);
  const url = `${DRIVE_FILES}?spaces=appDataFolder&q=${q}&fields=files(id,name)`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Drive list shard failed: ${res.status}`);
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

/** `files.list` for `meals-YYYY-MM.json` — overlaps safely with multipart photo upload when prefetched before shard write. */
export async function resolveMealsShardDriveFileId(
  token: string,
  monthKey: string,
): Promise<string | null> {
  return findMealsShardFileId(token, monthKey);
}

export async function listMealShardFiles(
  token: string,
  signal?: AbortSignal,
): Promise<{ id: string; monthKey: string }[]> {
  const q = encodeURIComponent(
    `name contains 'meals-' and name contains '.json' and trashed=false`,
  );
  const url = `${DRIVE_FILES}?spaces=appDataFolder&q=${q}&fields=files(id,name)`;
  const res = await fetch(url, { headers: authHeaders(token), signal });
  if (!res.ok) throw new Error(`Drive list meal shards failed: ${res.status}`);
  const data = (await res.json()) as { files?: { id: string; name: string }[] };
  const out: { id: string; monthKey: string }[] = [];
  for (const f of data.files ?? []) {
    const m = MEALS_SHARD_RE.exec(f.name);
    if (m) out.push({ id: f.id, monthKey: m[1] });
  }
  return out;
}

/** Downloads one `meals-YYYY-MM.json` shard from Drive App Data. */
export async function pullMealsShardRecords(
  token: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<MealRecord[]> {
  const url = `${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, { headers: authHeaders(token), signal });
  if (!res.ok) throw new Error(`Drive shard download failed: ${res.status}`);
  const text = await res.text();
  try {
    return normalizeMealsShardPayload(JSON.parse(text) as unknown);
  } catch {
    return [];
  }
}

/** Meal shard rows from Drive, newest `recordedAt` first. */
export async function pullMealsFromShardRefs(
  token: string,
  shards: readonly { id: string; monthKey: string }[],
  signal?: AbortSignal,
): Promise<MealRecord[]> {
  if (shards.length === 0) return [];
  const nested = await Promise.all(
    shards.map((s) => pullMealsShardRecords(token, s.id, signal)),
  );
  const meals = nested.flat();
  meals.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  return meals;
}

/** Lists meal shards then sorts by `YYYY-MM` descending (newest calendar month first). */
export async function listMealShardFilesSortedDesc(
  token: string,
  signal?: AbortSignal,
): Promise<{ id: string; monthKey: string }[]> {
  const shards = await listMealShardFiles(token, signal);
  shards.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return shards;
}

/**
 * Merges Drive rows for months that exist on the server but are not yet in `loadedMonthKeys`,
 * so shard sync does not treat unknown months as empty (which would delete remote data).
 */
export async function hydrateMealMonthsForPersist(
  token: string,
  meals: MealRecord[],
  monthKeysNeeded: readonly string[],
  loadedMonthKeys: ReadonlySet<string>,
  shardsOnDriveDesc: readonly { id: string; monthKey: string }[],
  signal?: AbortSignal,
): Promise<{ meals: MealRecord[]; hydratedMonthKeys: string[] }> {
  const hydratedMonthKeys: string[] = [];
  const byId = new Map(meals.map((m) => [m.id, m]));
  const shardByMonth = new Map(shardsOnDriveDesc.map((s) => [s.monthKey, s]));

  for (const mk of monthKeysNeeded) {
    if (loadedMonthKeys.has(mk)) continue;
    const shard = shardByMonth.get(mk);
    if (!shard) continue;
    const rows = await pullMealsShardRecords(token, shard.id, signal);
    hydratedMonthKeys.push(mk);
    for (const r of rows) {
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
  }

  const merged = [...byId.values()];
  merged.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  return { meals: merged, hydratedMonthKeys };
}

/** Groups meals by local calendar month `YYYY-MM`. */
export function groupMealsByMonthKey(meals: MealRecord[]): Map<string, MealRecord[]> {
  const map = new Map<string, MealRecord[]>();
  for (const m of meals) {
    const key = monthKeyFromRecordedAt(m.recordedAt);
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  for (const [k, arr] of map) {
    arr.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    map.set(k, arr);
  }
  return map;
}

async function deleteMealsShardIfExists(token: string, monthKey: string): Promise<void> {
  const id = await findMealsShardFileId(token, monthKey);
  if (!id) return;
  await deleteDriveFile(token, id);
}

async function upsertMealsShardToDrive(
  token: string,
  monthKey: string,
  meals: MealRecord[],
  prefetchedFileId?: string | null,
): Promise<void> {
  const fileName = mealsShardFileName(monthKey);
  const payload = JSON.stringify({ meals });
  const existing =
    prefetchedFileId !== undefined
      ? prefetchedFileId
      : await findMealsShardFileId(token, monthKey);
  if (existing) await updateJsonMedia(token, existing, payload);
  else await createMultipartJsonAppData(token, fileName, payload);
}

/**
 * Upserts or deletes shard files only for `affectedMonthKeys` (fresh `files.list` per month
 * unless an id was prefetched via `shardFileIdsPrefetched`).
 */
export async function syncMealShardsForMonths(
  token: string,
  meals: MealRecord[],
  affectedMonthKeys: Iterable<string>,
  shardFileIdsPrefetched?: Readonly<Record<string, string | null>>,
): Promise<void> {
  const uniqKeys = [...new Set(affectedMonthKeys)];
  const grouped = groupMealsByMonthKey(meals);
  for (const mk of uniqKeys) {
    const monthMeals = grouped.get(mk) ?? [];
    const prefetched = shardFileIdsPrefetched?.[mk];
    if (monthMeals.length === 0) {
      if (prefetched !== undefined) {
        if (prefetched) await deleteDriveFile(token, prefetched);
      } else {
        await deleteMealsShardIfExists(token, mk);
      }
    } else if (prefetched !== undefined) {
      await upsertMealsShardToDrive(token, mk, monthMeals, prefetched);
    } else {
      await upsertMealsShardToDrive(token, mk, monthMeals);
    }
  }
}

/** Writes all non-empty shards and deletes orphaned empty-month files (lists all meal shards once). */
export async function syncMealShardsToDrive(
  token: string,
  meals: MealRecord[],
): Promise<void> {
  const grouped = groupMealsByMonthKey(meals);
  const existing = await listMealShardFiles(token);
  const existingIdsByMonth = new Map(existing.map((e) => [e.monthKey, e.id]));

  for (const [monthKey, monthMeals] of grouped) {
    await upsertMealsShardToDrive(token, monthKey, monthMeals);
    existingIdsByMonth.delete(monthKey);
  }

  for (const [, fileId] of existingIdsByMonth) {
    await deleteDriveFile(token, fileId);
  }
}

export type PersistRecordsToDriveOptions = {
  coreOnly?: boolean;
  mealsOnly?: boolean;
  /**
   * With `mealsOnly`, writes only these `YYYY-MM` shards from `doc.meals` (no global shard listing).
   * If omitted while `mealsOnly` is set, falls back to full reconcile.
   */
  mealMonthKeysToSync?: string[];
  /**
   * Skip per-month `files.list` when resolving shard ids — use prefetched ids from a parallel probe
   * (keys are `YYYY-MM`, values are Drive file ids or `null` if absent).
   */
  shardFileIdsPrefetched?: Readonly<Record<string, string | null>>;
};

export async function persistRecordsToDrive(
  token: string,
  doc: RecordsDocument,
  options?: PersistRecordsToDriveOptions,
): Promise<void> {
  if (options?.coreOnly && options?.mealsOnly) {
    throw new Error("persistRecordsToDrive: coreOnly and mealsOnly cannot both be set");
  }
  const normalized = normalizeRecordsDocument(doc);
  const core: RecordsCoreDocument = {
    version: normalized.version,
    profile: normalized.profile,
    ...(normalized.geminiApiKey ? { geminiApiKey: normalized.geminiApiKey } : {}),
    ...(normalized.onboardingCompleted === true ? { onboardingCompleted: true } : {}),
    ...(normalized.onboardingDraft ? { onboardingDraft: normalized.onboardingDraft } : {}),
    ...(normalized.locale ? { locale: normalized.locale } : {}),
  };
  if (!options?.mealsOnly) {
    await upsertCoreRecordsToDrive(token, core);
  }
  if (!options?.coreOnly) {
    const monthKeys = options?.mealMonthKeysToSync;
    if (options?.mealsOnly && monthKeys && monthKeys.length > 0) {
      await syncMealShardsForMonths(
        token,
        normalized.meals,
        [...new Set(monthKeys)],
        options.shardFileIdsPrefetched,
      );
    } else {
      await syncMealShardsToDrive(token, normalized.meals);
    }
  }
}

/** Loads core from `CORE_DRIVE_FILE`, or `null` if missing. */
export async function pullRecordsCoreFromDrive(
  token: string,
): Promise<RecordsCoreDocument | null> {
  const primaryId = await findAppDataJsonFileIdByName(token, CORE_DRIVE_FILE);
  if (!primaryId) return null;
  return downloadCoreRecords(token, primaryId);
}

/** Loads and merges all `meals-YYYY-MM.json` shards under App Data. */
export async function pullMealsFromDriveShards(
  token: string,
  signal?: AbortSignal,
): Promise<MealRecord[]> {
  const shards = await listMealShardFilesSortedDesc(token, signal);
  return pullMealsFromShardRefs(token, shards, signal);
}

export async function pullRecordsFromDrive(
  token: string,
): Promise<RecordsDocument | null> {
  const core = await pullRecordsCoreFromDrive(token);
  if (!core) return null;
  const meals = await pullMealsFromDriveShards(token);
  return normalizeRecordsDocument({ ...core, meals });
}

/** Upload a meal snapshot image into the App Data folder; returns the Drive file id. */
export async function uploadMealPhotoToAppData(
  token: string,
  mealId: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const ext = extensionForMime(mimeType || "image/jpeg");
  const fileName = `meal-${mealId}.${ext}`;
  const bytes = base64ToUint8Array(base64);
  const boundary = `boundary_${crypto.randomUUID?.() ?? String(Date.now())}`;
  const partBreak = `\r\n--${boundary}\r\n`;

  const metadata = JSON.stringify({
    name: fileName,
    parents: ["appDataFolder"],
  });

  const enc = new TextEncoder();
  const mime = (mimeType || "").trim() || "image/jpeg";

  const chunks: Uint8Array[] = [
    enc.encode(`--${boundary}\r\n`),
    enc.encode("Content-Type: application/json; charset=UTF-8\r\n\r\n"),
    enc.encode(metadata),
    enc.encode(partBreak),
    enc.encode(`Content-Type: ${mime}\r\n\r\n`),
    bytes,
    enc.encode(`\r\n--${boundary}--`),
  ];

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const body = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  const url = `${UPLOAD_BASE}?uploadType=multipart`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Drive meal photo upload failed: ${res.status}`);
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Drive meal photo upload missing id");
  return data.id;
}

export function normalizeSavedMeal(row: unknown): SavedMealRecord | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  if (!id) return null;
  const rawName = typeof r.food_name === "string" ? r.food_name.trim() : "";
  const food_name = rawName.length > 0 ? rawName : "Meal";
  const calories = Number(r.calories);
  const protein = Number(r.protein);
  const fats = Number(r.fats);
  const carbs = Number(r.carbs);
  const photoFileId =
    typeof r.photoFileId === "string" && r.photoFileId.trim().length > 0
      ? r.photoFileId.trim()
      : undefined;
  const out: SavedMealRecord = {
    id,
    food_name,
    calories: Number.isFinite(calories) ? calories : 0,
    protein: Number.isFinite(protein) ? protein : 0,
    fats: Number.isFinite(fats) ? fats : 0,
    carbs: Number.isFinite(carbs) ? carbs : 0,
  };
  if (photoFileId) out.photoFileId = photoFileId;
  return out;
}

function parseSavedMealsFromJsonText(text: string): SavedMealRecord[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return [];
    const arr = (parsed as { savedMeals?: unknown }).savedMeals;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((row) => normalizeSavedMeal(row))
      .filter(Boolean) as SavedMealRecord[];
  } catch {
    return [];
  }
}

export async function upsertSavedMealsToDrive(
  token: string,
  savedMeals: SavedMealRecord[],
): Promise<void> {
  const body = JSON.stringify({ version: 1, savedMeals });
  const existingId = await findAppDataJsonFileIdByName(token, SAVED_MEALS_DRIVE_FILE);
  if (existingId) await updateJsonMedia(token, existingId, body);
  else await createMultipartJsonAppData(token, SAVED_MEALS_DRIVE_FILE, body);
}

export async function pullSavedMealsFromDrive(
  token: string,
  signal?: AbortSignal,
): Promise<SavedMealRecord[]> {
  const id = await findAppDataJsonFileIdByName(token, SAVED_MEALS_DRIVE_FILE);
  if (!id) return [];
  const text = await downloadAppDataFileText(token, id, signal);
  return parseSavedMealsFromJsonText(text);
}

/** Copies an App Data meal image to a new file for a saved-meal id (independent of the log row). */
export async function copyAppDataPhotoForSavedMeal(
  token: string,
  sourcePhotoFileId: string,
  savedMealId: string,
  signal?: AbortSignal,
): Promise<string> {
  const blob = await downloadAppDataFileBlob(token, sourcePhotoFileId, signal);
  const { base64, mimeType } = await blobToBase64(blob);
  return uploadMealPhotoToAppData(token, savedMealId, base64, mimeType);
}

function normalizeProgressPhotosManifestDoc(parsed: unknown): {
  photos: ProgressPhotoDriveMeta[];
} {
  if (!parsed || typeof parsed !== "object") {
    return { photos: [] };
  }
  const doc = parsed as Record<string, unknown>;
  const raw = doc.photos;
  if (!Array.isArray(raw)) {
    return { photos: [] };
  }
  const out: ProgressPhotoDriveMeta[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const driveFileId =
      typeof o.driveFileId === "string" ? o.driveFileId.trim() : "";
    const capturedAt = Number(o.capturedAt);
    if (!id || !driveFileId || !Number.isFinite(capturedAt)) continue;
    out.push({ id, driveFileId, capturedAt });
  }
  return { photos: out };
}

function buildProgressPhotosManifestJson(photos: ProgressPhotoDriveMeta[]): string {
  return JSON.stringify({ version: 1, photos });
}

async function readProgressPhotosManifest(token: string): Promise<{
  manifestFileId: string | null;
  photos: ProgressPhotoDriveMeta[];
}> {
  const manifestFileId = await findAppDataJsonFileIdByName(
    token,
    PROGRESS_PHOTOS_MANIFEST_FILE,
  );
  if (!manifestFileId) {
    return { manifestFileId: null, photos: [] };
  }
  const text = await downloadAppDataFileText(token, manifestFileId);
  try {
    const parsed = JSON.parse(text) as unknown;
    const { photos } = normalizeProgressPhotosManifestDoc(parsed);
    return { manifestFileId, photos };
  } catch {
    return { manifestFileId, photos: [] };
  }
}

async function upsertProgressPhotosManifest(
  token: string,
  manifestFileId: string | null,
  photos: ProgressPhotoDriveMeta[],
): Promise<void> {
  const payload = buildProgressPhotosManifestJson(photos);
  if (manifestFileId) await updateJsonMedia(token, manifestFileId, payload);
  else await createMultipartJsonAppData(token, PROGRESS_PHOTOS_MANIFEST_FILE, payload);
}

/** Upload a progress photo JPEG into App Data; returns Drive file id. */
export async function uploadProgressPhotoImageToAppData(
  token: string,
  photoId: string,
  blob: Blob,
): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const fileName = `progress-photo-${photoId}.jpg`;
  const boundary = `boundary_${crypto.randomUUID?.() ?? String(Date.now())}`;
  const partBreak = `\r\n--${boundary}\r\n`;

  const metadata = JSON.stringify({
    name: fileName,
    parents: ["appDataFolder"],
  });

  const enc = new TextEncoder();
  const mime = blob.type?.trim() || "image/jpeg";

  const chunks: Uint8Array[] = [
    enc.encode(`--${boundary}\r\n`),
    enc.encode("Content-Type: application/json; charset=UTF-8\r\n\r\n"),
    enc.encode(metadata),
    enc.encode(partBreak),
    enc.encode(`Content-Type: ${mime}\r\n\r\n`),
    bytes,
    enc.encode(`\r\n--${boundary}--`),
  ];

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const body = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  const url = `${UPLOAD_BASE}?uploadType=multipart`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Drive progress photo upload failed: ${res.status}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Drive progress photo upload missing id");
  return data.id;
}

/**
 * Syncs the progress-photos manifest with Drive and any IndexedDB-only rows (upload + clear local).
 * Does not download image blobs — use {@link downloadAppDataFileBlob} per image for lazy loading.
 */
export async function syncProgressPhotosManifestFromDrive(
  token: string,
  _signal?: AbortSignal,
): Promise<{ photos: ProgressPhotoDriveMeta[] }> {
  const { manifestFileId, photos: merged } = await readProgressPhotosManifest(token);
  const localRows = await listProgressPhotosDesc();

  const manifestIds = new Set(merged.map((p) => p.id));
  let changed = false;
  for (const row of localRows) {
    if (manifestIds.has(row.id)) continue;
    const driveFileId = await uploadProgressPhotoImageToAppData(token, row.id, row.blob);
    merged.push({
      id: row.id,
      driveFileId,
      capturedAt: row.capturedAt,
    });
    manifestIds.add(row.id);
    changed = true;
  }
  if (changed) {
    merged.sort((a, b) => b.capturedAt - a.capturedAt);
    await upsertProgressPhotosManifest(token, manifestFileId, merged);
  }

  if (localRows.length > 0) {
    await clearProgressPhotosIndexedDb();
  }

  merged.sort((a, b) => b.capturedAt - a.capturedAt);
  return { photos: merged };
}

/**
 * Loads progress photos from Drive (manifest + every image download). Prefer manifest sync +
 * lazy blob loads in the UI for large libraries.
 */
export async function pullProgressPhotosFromDrive(
  token: string,
  signal?: AbortSignal,
): Promise<ProgressPhotosPullResult> {
  const { photos: merged } = await syncProgressPhotosManifestFromDrive(token, signal);

  const records: ProgressPhotoRecord[] = [];
  for (const meta of merged) {
    try {
      const blob = await downloadAppDataFileBlob(token, meta.driveFileId, signal);
      records.push({
        id: meta.id,
        capturedAt: meta.capturedAt,
        blob,
      });
    } catch {
      /* transient or missing file — skip entry */
    }
  }
  records.sort((a, b) => b.capturedAt - a.capturedAt);
  return { photos: records };
}

export async function addProgressPhotoToDrive(
  token: string,
  record: ProgressPhotoRecord,
): Promise<void> {
  const driveFileId = await uploadProgressPhotoImageToAppData(token, record.id, record.blob);
  const { manifestFileId, photos } = await readProgressPhotosManifest(token);
  const next = photos.filter((p) => p.id !== record.id);
  next.push({
    id: record.id,
    driveFileId,
    capturedAt: record.capturedAt,
  });
  next.sort((a, b) => b.capturedAt - a.capturedAt);
  await upsertProgressPhotosManifest(token, manifestFileId, next);
}

export async function deleteProgressPhotoFromDrive(
  token: string,
  photoId: string,
): Promise<void> {
  const { manifestFileId, photos } = await readProgressPhotosManifest(token);
  if (!manifestFileId) return;
  const entry = photos.find((p) => p.id === photoId);
  const next = photos.filter((p) => p.id !== photoId);
  if (entry) {
    try {
      await deleteDriveFile(token, entry.driveFileId);
    } catch {
      /* best-effort */
    }
  }
  await updateJsonMedia(
    token,
    manifestFileId,
    buildProgressPhotosManifestJson(next),
  );
}

export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  const url = `${DRIVE_FILES}/${encodeURIComponent(fileId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Drive delete failed: ${res.status}`);
  }
}

/**
 * Deletes every file in this app's Drive App Data folder for the authorized user.
 * Does not revoke Google sign-in; the next load creates fresh `core.json` etc.
 */
export async function deleteAllAppDataFiles(
  token: string,
  signal?: AbortSignal,
): Promise<{ deleted: number; failures: { name: string; message: string }[] }> {
  const files = await listAllAppDataFiles(token, signal);
  const failures: { name: string; message: string }[] = [];
  let deleted = 0;
  for (const f of files) {
    try {
      await deleteDriveFile(token, f.id);
      deleted++;
    } catch (e) {
      failures.push({
        name: f.name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { deleted, failures };
}
