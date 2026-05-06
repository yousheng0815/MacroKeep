/** Minimal typings for https://accounts.google.com/gsi/client (GIS token client). */

export type GoogleOAuth2TokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

/** GIS invokes this when the OAuth popup fails or closes before a token is returned. */
export type GoogleOAuth2TokenErrorDetail = {
  type: "popup_closed" | "popup_failed_to_open" | string;
};

export type GoogleOAuth2TokenClient = {
  requestAccessToken: (
    overrideConfig?: { prompt?: string; login_hint?: string },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            /** Empty string: prompt only on first access (not `select_account` every time). */
            prompt?: string;
            callback: (resp: GoogleOAuth2TokenResponse) => void;
            error_callback?: (detail: GoogleOAuth2TokenErrorDetail) => void;
          }) => GoogleOAuth2TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export {};
