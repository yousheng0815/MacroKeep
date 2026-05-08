/** Encode any image blob for Gemini / uploads (uses a synthetic filename for DataURL parsing). */
export function blobToBase64(blob: Blob): Promise<{ base64: string; mimeType: string }> {
  return fileToBase64(
    new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }),
  );
}

export function fileToBase64(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      if (typeof res !== "string") {
        reject(new Error("Unexpected read result"));
        return;
      }
      const comma = res.indexOf(",");
      const base64 = comma >= 0 ? res.slice(comma + 1) : res;
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
