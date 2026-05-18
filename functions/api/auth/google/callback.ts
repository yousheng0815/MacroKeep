import type { OAuthBindings } from "../../../../server/oauth/bindings.js";
import { handleAuthGoogleCallback } from "../../../../server/oauth/handlers/auth-google-callback.js";

export const onRequestGet: PagesFunction<OAuthBindings> = ({ request, env }) =>
  handleAuthGoogleCallback(request, env);
