/**
 * Parsed step-up authentication challenge from a WWW-Authenticate header.
 *
 * Per RFC 9470 (OAuth 2.0 Step-Up Authentication Challenge Protocol), a resource server
 * returns this challenge when the current access token does not meet the authentication
 * requirements for the requested resource.
 */
export interface StepUpChallenge {
  /** Authentication context class references required, parsed from `acr_values`. */
  acrValues?: string[];

  /** Maximum acceptable authentication age in seconds, parsed from `max_age`. */
  maxAge?: number;

  /** Required scopes, parsed from `scope`. */
  scope?: string;

  /** Human-readable error description, parsed from `error_description`. */
  errorDescription?: string;
}

const STEP_UP_ERRORS = ["insufficient_user_authentication", "insufficient_scope"] as const;

const TOKEN_CHAR_REGEX = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]$/;

function isTokenChar(char: string): boolean {
  return TOKEN_CHAR_REGEX.test(char);
}

/**
 * Parses auth-param values from a Bearer WWW-Authenticate header.
 *
 * Handles both quoted (`key="value"`) and unquoted (`key=value`) parameter formats
 * per RFC 9110 (HTTP Semantics).
 */
function parseAuthParams(header: string): Map<string, string> {
  const params = new Map<string, string>();
  const normalizedHeader = header.trimStart();

  // Strip "Bearer" prefix (case-insensitive) and leading whitespace
  const paramString = normalizedHeader.replace(/^Bearer\s*/i, "").trim();
  if (!paramString) {
    return params;
  }

  let index = 0;

  while (index < paramString.length) {
    while (index < paramString.length && /[\s,]/.test(paramString[index] as string)) {
      index += 1;
    }

    if (index >= paramString.length) {
      break;
    }

    const keyStart = index;
    while (index < paramString.length && isTokenChar(paramString[index] as string)) {
      index += 1;
    }

    if (index === keyStart) {
      index += 1;
      continue;
    }

    const key = paramString.slice(keyStart, index);

    while (index < paramString.length && /\s/.test(paramString[index] as string)) {
      index += 1;
    }

    if (paramString[index] !== "=") {
      while (index < paramString.length && paramString[index] !== ",") {
        index += 1;
      }
      continue;
    }

    index += 1;

    while (index < paramString.length && /\s/.test(paramString[index] as string)) {
      index += 1;
    }

    if (paramString[index] === '"') {
      index += 1;
      let value = "";

      while (index < paramString.length) {
        const char = paramString[index] as string;

        if (char === "\\") {
          const escaped = paramString[index + 1];
          if (escaped === undefined) {
            break;
          }
          value += escaped;
          index += 2;
          continue;
        }

        if (char === '"') {
          index += 1;
          break;
        }

        value += char;
        index += 1;
      }

      params.set(key, value);
      continue;
    }

    const valueStart = index;
    while (index < paramString.length && isTokenChar(paramString[index] as string)) {
      index += 1;
    }

    if (index > valueStart) {
      params.set(key, paramString.slice(valueStart, index));
    }
  }

  return params;
}

/**
 * Parses a `WWW-Authenticate` header value for a step-up authentication challenge.
 *
 * Supports two error codes:
 * - `insufficient_user_authentication` (RFC 9470): Authentication strength is insufficient.
 *   Extracts `acr_values`, `max_age`, and optionally `scope`.
 * - `insufficient_scope` (RFC 6750): Token lacks required scopes/permissions.
 *   Extracts the required `scope`.
 *
 * @param header - The value of the `WWW-Authenticate` response header
 * @returns Parsed step-up challenge parameters
 * @throws {Error} If the header does not use the Bearer scheme
 * @throws {Error} If the error is not a recognized step-up challenge error
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9470 RFC 9470}
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6750 RFC 6750}
 */
export function parseStepUpChallenge(header: string): StepUpChallenge {
  if (!header.trim().match(/^Bearer\s/i)) {
    throw new Error("WWW-Authenticate header does not use the Bearer scheme");
  }

  const params = parseAuthParams(header);
  const error = params.get("error");

  if (!error || !STEP_UP_ERRORS.includes(error as (typeof STEP_UP_ERRORS)[number])) {
    throw new Error(
      `WWW-Authenticate error is "${error ?? ""}", expected one of: ${STEP_UP_ERRORS.map((e) => `"${e}"`).join(", ")}`,
    );
  }

  const challenge: StepUpChallenge = {};

  const acrValues = params.get("acr_values");
  if (acrValues) {
    challenge.acrValues = acrValues.split(" ").filter(Boolean);
  }

  const maxAge = params.get("max_age");
  if (maxAge !== undefined) {
    if (!/^\d+$/.test(maxAge)) {
      throw new Error(`Invalid max_age value: "${maxAge}"`);
    }

    const parsed = Number.parseInt(maxAge, 10);
    if (parsed < 0) {
      throw new Error(`Invalid max_age value: "${maxAge}"`);
    }
    challenge.maxAge = parsed;
  }

  const scope = params.get("scope");
  if (scope) {
    challenge.scope = scope;
  }

  const errorDescription = params.get("error_description");
  if (errorDescription) {
    challenge.errorDescription = errorDescription;
  }

  return challenge;
}
