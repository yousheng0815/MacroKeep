import type { OAuthBindings } from "../../../server/oauth/bindings.js";
import { handleAccessToken } from "../../../server/oauth/handlers/access-token.js";

export const onRequestPost: PagesFunction<OAuthBindings> = ({ request, env }) =>
  handleAccessToken(request, env);
