/** Heading on `/login` before the user has completed Google sign-in / Drive consent. */
export const LOGIN_WELCOME_TITLE = "Welcome";

/** Body text on `/login` when starting or returning sign-in (not the Drive consent step). */
export const LOGIN_WELCOME_BLURB =
  "Sign in with Google to use MacroKeep. Your diary syncs to your Google account.";

/** Heading when the app needs a fresh Google sign-in (e.g. session expired). */
export const AUTH_SIGN_IN_AGAIN_TITLE = "Sign in again";

/** Heading when the user is signed in but must grant Drive app-data scope before the app can load. */
export const GOOGLE_DRIVE_APP_DATA_CONSENT_TITLE = "Allow Drive access";

/** Shown on login / auth gate when explaining Drive app-data scope. */
export const GOOGLE_DRIVE_APP_DATA_BLURB =
  "We need Google Drive access to save your data. It's limited to MacroKeep's own app folder on Drive. We can't see your other files.";
