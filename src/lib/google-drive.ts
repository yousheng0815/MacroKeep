import type {
  MealRecord,
  RecordsCoreDocument,
  RecordsDocument,
} from "@/types/records";
import { emptyRecords } from "@/types/records";

const RECORDS_NAME = "records.json";
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
  const thumbnailFileId =
    typeof row.thumbnailFileId === "string" && row.thumbnailFileId.trim().length > 0
      ? row.thumbnailFileId.trim()
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
  if (thumbnailFileId) meal.thumbnailFileId = thumbnailFileId;
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

export function normalizeRecordsCoreDocument(
  parsed: Partial<RecordsCoreDocument> | null | undefined,
): RecordsCoreDocument {
  const empty = emptyRecords();
  if (!parsed || typeof parsed !== "object") {
    return {
      version: empty.version,
      updatedAt: empty.updatedAt,
      profile: { ...empty.profile },
    };
  }
  const gemini =
    typeof parsed.geminiApiKey === "string" && parsed.geminiApiKey.trim().length > 0
      ? parsed.geminiApiKey.trim()
      : undefined;
  return {
    version: typeof parsed.version === "number" ? parsed.version : empty.version,
    updatedAt:
      typeof parsed.updatedAt === "string" ? parsed.updatedAt : empty.updatedAt,
    profile: { ...empty.profile, ...parsed.profile },
    ...(gemini !== undefined ? { geminiApiKey: gemini } : {}),
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

/** One file in the user's hidden Drive App Data folder (same space as `records.json`). */
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

export async function findRecordsFileId(token: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${RECORDS_NAME}' and trashed=false`,
  );
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

async function updateJsonMedia(token: string, fileId: string, body: string): Promise<void> {
  const url = `${UPLOAD_BASE}/${encodeURIComponent(fileId)}?uploadType=media`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json; charset=UTF-8",
    },
    body,
  });
  if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
}

export async function upsertCoreRecordsToDrive(
  token: string,
  core: RecordsCoreDocument,
): Promise<void> {
  const normalized = normalizeRecordsCoreDocument(core);
  const payload = JSON.stringify({
    ...normalized,
    updatedAt: new Date().toISOString(),
  });
  const existing = await findRecordsFileId(token);
  if (existing) await updateJsonMedia(token, existing, payload);
  else await createMultipartJsonAppData(token, RECORDS_NAME, payload);
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

async function downloadMealsShard(
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

async function upsertMealsShardToDrive(
  token: string,
  monthKey: string,
  meals: MealRecord[],
): Promise<void> {
  const fileName = mealsShardFileName(monthKey);
  const payload = JSON.stringify({ meals });
  const existing = await findMealsShardFileId(token, monthKey);
  if (existing) await updateJsonMedia(token, existing, payload);
  else await createMultipartJsonAppData(token, fileName, payload);
}

/** Writes core + reconciles monthly shard files to match `meals`. */
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

export async function persistRecordsToDrive(
  token: string,
  doc: RecordsDocument,
  options?: { coreOnly?: boolean },
): Promise<void> {
  const normalized = normalizeRecordsDocument(doc);
  const core: RecordsCoreDocument = {
    version: normalized.version,
    updatedAt: normalized.updatedAt,
    profile: normalized.profile,
    ...(normalized.geminiApiKey ? { geminiApiKey: normalized.geminiApiKey } : {}),
  };
  await upsertCoreRecordsToDrive(token, core);
  if (!options?.coreOnly) {
    await syncMealShardsToDrive(token, normalized.meals);
  }
}

/** Loads only `records.json` (profile, targets, Gemini key metadata). */
export async function pullRecordsCoreFromDrive(
  token: string,
): Promise<RecordsCoreDocument | null> {
  const id = await findRecordsFileId(token);
  if (!id) return null;
  return downloadCoreRecords(token, id);
}

/** Loads and merges all `meals-YYYY-MM.json` shards under App Data. */
export async function pullMealsFromDriveShards(
  token: string,
  signal?: AbortSignal,
): Promise<MealRecord[]> {
  const shards = await listMealShardFiles(token, signal);
  const mealsNested = await Promise.all(
    shards.map((s) => downloadMealsShard(token, s.id, signal)),
  );
  const meals = mealsNested.flat();
  meals.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  return meals;
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
  variant: "full" | "thumb" = "full",
): Promise<string> {
  const ext = extensionForMime(mimeType || "image/jpeg");
  const fileName = `openmacro-meal-${mealId}-${variant}.${ext}`;
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
