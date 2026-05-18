import type { OAuthBindings } from "../bindings.js";
import { refreshAccessToken } from "../google-token.js";
import { noStore } from "../response.js";

async function parseJsonBody(
  request: Request,
): Promise<{ refresh_token?: string }> {
  try {
    return (await request.json()) as { refresh_token?: string };
  } catch {
    return {};
  }
}

export async function handleAccessToken(
  request: Request,
  env: OAuthBindings,
): Promise<Response> {
  try {
    const { refresh_token: refreshToken } = await parseJsonBody(request);
    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      return noStore(
        Response.json({ error: "no_refresh_token" }, { status: 401 }),
      );
    }

    const tok = await refreshAccessToken(env, refreshToken);

    return noStore(
      Response.json({
        access_token: tok.access_token,
        expires_in: tok.expires_in,
        scope: tok.scope,
        token_type: tok.token_type ?? "Bearer",
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh_failed";
    const lower = msg.toLowerCase();
    const invalid_grant =
      lower.includes("invalid_grant") ||
      lower.includes("token has been expired or revoked");
    return noStore(
      Response.json({ error: msg, invalid_grant }, { status: 401 }),
    );
  }
}
