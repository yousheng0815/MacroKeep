import type { ComboItem } from "@/types/records";

export type ComboDraft = {
  name: string;
  items: ComboItem[];
  customPhotoFileId?: string;
  returnTo: string;
};

export function comboDraftKey(options: {
  context?: "new";
  comboId?: string;
}): string {
  if (options.comboId) return `combo-draft-edit-${options.comboId}`;
  return "combo-draft-new";
}

export function comboEditorReturnTo(options: {
  context?: "new";
  comboId?: string;
}): string {
  if (options.comboId) {
    return `/add/saved-meals/combo/${options.comboId}/edit`;
  }
  return "/add/saved-meals/combo/new";
}

export function readComboDraft(key: string): ComboDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ComboDraft;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.name !== "string" || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeComboDraft(key: string, draft: ComboDraft): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    /* quota */
  }
}

const NEW_COMBO_SESSION_KEY = "combo-draft-new-session";

export function beginNewComboDraftSession(): void {
  try {
    sessionStorage.setItem(NEW_COMBO_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function endNewComboDraftSession(): void {
  try {
    sessionStorage.removeItem(NEW_COMBO_SESSION_KEY);
  } catch {
    /* ignore */
  }
  clearComboDraft(comboDraftKey({ context: "new" }));
}

export function isNewComboDraftSessionActive(): boolean {
  try {
    return sessionStorage.getItem(NEW_COMBO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

const COMBO_EDIT_SESSION_KEY = "combo-draft-edit-session-id";

export function beginComboEditDraftSession(comboId: string): void {
  try {
    sessionStorage.setItem(COMBO_EDIT_SESSION_KEY, comboId);
  } catch {
    /* ignore */
  }
}

export function endComboEditDraftSession(): void {
  try {
    const comboId = sessionStorage.getItem(COMBO_EDIT_SESSION_KEY);
    sessionStorage.removeItem(COMBO_EDIT_SESSION_KEY);
    if (comboId) clearComboDraft(comboDraftKey({ comboId }));
  } catch {
    /* ignore */
  }
}

export function isComboEditDraftSessionActive(comboId: string): boolean {
  try {
    return sessionStorage.getItem(COMBO_EDIT_SESSION_KEY) === comboId;
  } catch {
    return false;
  }
}

export function clearComboDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function appendSavedMealToComboItems(
  items: ComboItem[],
  savedMealId: string,
): ComboItem[] {
  return [...items, { source: "saved", savedMealId }];
}
