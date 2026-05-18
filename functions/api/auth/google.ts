import type { OAuthBindings } from "../../../server/oauth/bindings.js";
import { handleAuthGoogle } from "../../../server/oauth/handlers/auth-google.js";

export const onRequestGet: PagesFunction<OAuthBindings> = ({ request, env }) =>
  handleAuthGoogle(request, env);
