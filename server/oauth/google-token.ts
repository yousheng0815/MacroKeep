import { requireEnv } from "./config.js";

export type TokenSuccess = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type TokenSuccessWithRefresh = TokenSuccess & {
  refresh_token?: string;
};

async function postToken(body: Record<string, string>): Promise<unknown> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      typeof json.error_description === "string"
        ? json.error_description
        : typeof json.error === "string"
          ? json.error
          : `token_http_${res.status}`;
    throw new Error(err);
  }
  return json;
}

export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<TokenSuccessWithRefresh> {
  const client_id = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
  const client_secret = requireEnv("GOOGLE_OAUTH_CLIENT_SECRET");

  const json = (await postToken({
    grant_type: "authorization_code",
    code,
    client_id,
    client_secret,
    redirect_uri: redirectUri,
  })) as Record<string, unknown>;

  const access_token =
    typeof json.access_token === "string" ? json.access_token : "";
  const expires_in =
    typeof json.expires_in === "number" ? json.expires_in : 3600;
  if (!access_token) throw new Error("Missing access_token from Google");

  const refresh_token =
    typeof json.refresh_token === "string" ? json.refresh_token : undefined;
  const scope = typeof json.scope === "string" ? json.scope : undefined;
  const token_type =
    typeof json.token_type === "string" ? json.token_type : undefined;

  return {
    access_token,
    expires_in,
    refresh_token,
    scope,
    token_type,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenSuccess> {
  const client_id = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
  const client_secret = requireEnv("GOOGLE_OAUTH_CLIENT_SECRET");

  const json = (await postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id,
    client_secret,
  })) as Record<string, unknown>;

  const access_token =
    typeof json.access_token === "string" ? json.access_token : "";
  const expires_in =
    typeof json.expires_in === "number" ? json.expires_in : 3600;
  if (!access_token) throw new Error("Missing access_token from refresh");

  const scope = typeof json.scope === "string" ? json.scope : undefined;
  const token_type =
    typeof json.token_type === "string" ? json.token_type : undefined;

  return {
    access_token,
    expires_in,
    scope,
    token_type,
  };
}
