import { describe, expect, test } from "bun:test";
import { NO_DEFAULT_IDAAS_CLIENT } from "../constants";

describe("IdaasClient.parseResponse", () => {
  const createStepUpResponse = (wwwAuthenticate: string, status = 401): Response => {
    return new Response(null, {
      status,
      headers: { "WWW-Authenticate": wwwAuthenticate },
    });
  };

  test("returns parsed acr_values and max_age requirements", () => {
    const apiResponse = createStepUpResponse(
      'Bearer error="insufficient_user_authentication", acr_values="urn:acr:mfa", max_age="300"',
    );

    const result = NO_DEFAULT_IDAAS_CLIENT.parseResponse(apiResponse);

    expect(result).toEqual({
      acrValues: ["urn:acr:mfa"],
      maxAge: 300,
    });
  });

  test("returns scope from the WWW-Authenticate header", () => {
    const apiResponse = createStepUpResponse(
      'Bearer error="insufficient_user_authentication", acr_values="myACR", scope="openid transactions"',
    );

    const result = NO_DEFAULT_IDAAS_CLIENT.parseResponse(apiResponse);

    expect(result).toEqual({
      acrValues: ["myACR"],
      scope: "openid transactions",
    });
  });

  test("returns scope-only requirements for insufficient_scope", () => {
    const apiResponse = createStepUpResponse('Bearer error="insufficient_scope", scope="read write"');

    const result = NO_DEFAULT_IDAAS_CLIENT.parseResponse(apiResponse);

    expect(result).toEqual({ scope: "read write" });
  });

  test("throws when response has no WWW-Authenticate header", () => {
    const apiResponse = new Response(null, { status: 401 });

    expect(() => {
      NO_DEFAULT_IDAAS_CLIENT.parseResponse(apiResponse);
    }).toThrowError("Response does not contain a WWW-Authenticate header");
  });

  test("throws when WWW-Authenticate error is not a recognized step-up error", () => {
    const apiResponse = createStepUpResponse('Bearer error="invalid_token"');

    expect(() => {
      NO_DEFAULT_IDAAS_CLIENT.parseResponse(apiResponse);
    }).toThrowError('WWW-Authenticate error is "invalid_token"');
  });

  test("does not require an authenticated user to parse the response", () => {
    const apiResponse = createStepUpResponse('Bearer error="insufficient_user_authentication", acr_values="myACR"');

    const result = NO_DEFAULT_IDAAS_CLIENT.parseResponse(apiResponse);

    expect(result).toEqual({ acrValues: ["myACR"] });
  });
});
