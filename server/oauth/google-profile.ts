export async function fetchGoogleProfile(accessToken: string): Promise<{
  sub: string;
  email: string | null;
}> {
  const res = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok) throw new Error("Google userinfo request failed");
  const data = (await res.json()) as { sub?: string; email?: string };
  if (typeof data.sub !== "string" || data.sub.length === 0) {
    throw new Error("Missing Google user id");
  }
  return {
    sub: data.sub,
    email: typeof data.email === "string" ? data.email : null,
  };
}
