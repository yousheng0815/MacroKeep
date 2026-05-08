import { useEffect, useState } from "react";

/**
 * Stable blob: URLs must be created/revoked in an effect — pairing `useMemo(createObjectURL)`
 * with `useEffect(() => () => revoke)` breaks under React Strict Mode: memo can return a
 * revoked URL because `blob` reference is unchanged after the first effect cleanup.
 */
export function useBlobObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob || blob.size < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL field when blob clears (effect-owned lifecycle)
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [blob]);

  return url;
}
