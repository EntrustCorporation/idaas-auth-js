import type { IdaasContext } from "../IdaasContext";
import type { OidcLoginOptions, TokenOptions } from "../models";
import type { StorageManager } from "../storage/StorageManager";
import { listenToAuthorizePopup, openPopup } from "../utils/browser";
import { formatUrl, sanitizeUri } from "../utils/format";
import { parseAndSaveTokenResponse, requestAndValidateTokens } from "./token";
import { generateAuthorizationUrl, validateAuthorizeResponse } from "./url";

/**
 * Perform the authorization code flow using a new popup window at the OpenID Provider (OP) to authenticate the user.
 */
export const loginWithPopup = async ({
  audience,
  scope,
  redirectUri,
  useRefreshToken,
  acrValues,
  maxAge,
  context,
  storageManager,
}: OidcLoginOptions & TokenOptions & { context: IdaasContext; storageManager: StorageManager }): Promise<
  string | null
> => {
  const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);

  const { url, nonce, state, codeVerifier } = await generateAuthorizationUrl(await context.getConfig(), {
    type: "standard",
    clientId: context.clientId,
    responseMode: "web_message",
    redirectUri: finalRedirectUri,
    useRefreshToken: useRefreshToken ?? context.globalUseRefreshToken,
    scope: scope ?? context.globalScope,
    audience: audience ?? context.globalAudience,
    acrValues: acrValues,
    maxAge: maxAge ?? -1,
    storageManager: storageManager,
  });

  const popup = openPopup(url);
  const authorizeResponse = await listenToAuthorizePopup(popup, url);
  const authorizeCode = validateAuthorizeResponse(authorizeResponse, state);
  const validatedTokenResponse = await requestAndValidateTokens(
    authorizeCode,
    codeVerifier,
    finalRedirectUri,
    nonce,
    context,
  );

  parseAndSaveTokenResponse(validatedTokenResponse, storageManager);

  // redirect only if the redirectUri is not the current uri
  if (formatUrl(window.location.href) !== formatUrl(finalRedirectUri)) {
    window.location.href = finalRedirectUri;
  }

  return validatedTokenResponse.tokenResponse.access_token;
};

/**
 * Perform the authorization code flow using a redirect to the OpenID Provider (OP) to authenticate the user.
 */
export const loginWithRedirect = async ({
  audience,
  scope,
  redirectUri,
  useRefreshToken,
  acrValues,
  maxAge,
  context,
  storageManager,
}: OidcLoginOptions & TokenOptions & { context: IdaasContext; storageManager: StorageManager }): Promise<void> => {
  const finalRedirectUri = redirectUri ?? sanitizeUri(window.location.href);
  const { url, nonce, state, codeVerifier } = await generateAuthorizationUrl(await context.getConfig(), {
    type: "standard",
    clientId: context.clientId,
    responseMode: "query",
    redirectUri: finalRedirectUri,
    useRefreshToken: useRefreshToken ?? context.globalUseRefreshToken,
    scope: scope ?? context.globalScope,
    audience: audience ?? context.globalAudience,
    acrValues: acrValues,
    maxAge: maxAge ?? -1,
    storageManager: storageManager,
  });

  storageManager.saveClientParams({
    nonce,
    state,
    codeVerifier,
    redirectUri: finalRedirectUri,
  });

  window.location.href = url;
};
