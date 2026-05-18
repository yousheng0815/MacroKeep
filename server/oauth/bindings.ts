/** Cloudflare Pages / Workers secrets and vars for OAuth routes. */
export type OAuthBindings = {
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  MK_SITE_ORIGIN?: string;
};

export function requireBinding(
  env: OAuthBindings,
  name: keyof Pick<
    OAuthBindings,
    "GOOGLE_OAUTH_CLIENT_ID" | "GOOGLE_OAUTH_CLIENT_SECRET"
  >,
): string {
  const v = env[name]?.trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
