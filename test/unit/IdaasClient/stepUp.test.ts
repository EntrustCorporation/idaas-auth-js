import { afterAll, afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import type { AuthenticationResponse } from "../../../src/models";
import { NO_DEFAULT_IDAAS_CLIENT } from "../constants";
import { mockFetch, storeData } from "../helpers";

describe("IdaasClient.stepUp", () => {
  // @ts-expect-error not full type
  const _spyOnFetch = spyOn(window, "fetch").mockImplementation(mockFetch);

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  const createStepUpResponse = (wwwAuthenticate: string, status = 401): Response => {
    return new Response(null, {
      status,
      headers: { "WWW-Authenticate": wwwAuthenticate },
    });
  };

  const interactiveChallenge: AuthenticationResponse = {
    method: "PASSWORD",
    pollForCompletion: false,
    authenticationCompleted: false,
  };

  const pollableChallenge: AuthenticationResponse = {
    method: "TOKENPUSH",
    pollForCompletion: true,
    authenticationCompleted: false,
  };

  const completedResponse: AuthenticationResponse = {
    method: "TOKENPUSH",
    authenticationCompleted: true,
  };

  test("parses WWW-Authenticate header and calls requestChallenge with correct acr_values and max_age", async () => {
    storeData({ idToken: true });
    const spyRequestChallenge = spyOn(NO_DEFAULT_IDAAS_CLIENT.rba, "requestChallenge").mockResolvedValue(
      interactiveChallenge,
    );

    const apiResponse = createStepUpResponse(
      'Bearer error="insufficient_user_authentication", acr_values="urn:acr:mfa", max_age="300"',
    );

    await NO_DEFAULT_IDAAS_CLIENT.stepUp(apiResponse);

    expect(spyRequestChallenge).toHaveBeenCalledTimes(1);
    const callArgs = spyRequestChallenge.mock.calls[0];
    expect(callArgs).toBeDefined();
    if (!callArgs) {
      throw new Error("requestChallenge was not called");
    }
    const authParams = callArgs[0];
    const tokenOptions = callArgs[1];
    expect(authParams).toEqual({ userId: "testingsubclaim" });
    expect(tokenOptions).toEqual({
      acrValues: ["urn:acr:mfa"],
      maxAge: 300,
      scope: undefined,
    });
  });

  test("passes scope from WWW-Authenticate header to tokenOptions", async () => {
    storeData({ idToken: true });
    const spyRequestChallenge = spyOn(NO_DEFAULT_IDAAS_CLIENT.rba, "requestChallenge").mockResolvedValue(
      interactiveChallenge,
    );

    const apiResponse = createStepUpResponse(
      'Bearer error="insufficient_user_authentication", acr_values="myACR", scope="openid transactions"',
    );

    await NO_DEFAULT_IDAAS_CLIENT.stepUp(apiResponse);

    const callArgs = spyRequestChallenge.mock.calls[0];
    expect(callArgs).toBeDefined();
    if (!callArgs) {
      throw new Error("requestChallenge was not called");
    }
    const tokenOptions = callArgs[1];
    expect(tokenOptions).toEqual({
      acrValues: ["myACR"],
      maxAge: undefined,
      scope: "openid transactions",
    });
  });

  test("returns challenge response for interactive authenticators (pollForCompletion: false)", async () => {
    storeData({ idToken: true });
    spyOn(NO_DEFAULT_IDAAS_CLIENT.rba, "requestChallenge").mockResolvedValue(interactiveChallenge);

    const apiResponse = createStepUpResponse('Bearer error="insufficient_user_authentication", acr_values="myACR"');

    const result = await NO_DEFAULT_IDAAS_CLIENT.stepUp(apiResponse);

    expect(result).toEqual(interactiveChallenge);
    expect(result.pollForCompletion).toBe(false);
  });

  test("auto-polls and returns final result when pollForCompletion is true", async () => {
    storeData({ idToken: true });
    spyOn(NO_DEFAULT_IDAAS_CLIENT.rba, "requestChallenge").mockResolvedValue(pollableChallenge);
    const spyPoll = spyOn(NO_DEFAULT_IDAAS_CLIENT.rba, "poll").mockResolvedValue(completedResponse);

    const apiResponse = createStepUpResponse('Bearer error="insufficient_user_authentication", acr_values="myACR"');

    const result = await NO_DEFAULT_IDAAS_CLIENT.stepUp(apiResponse);

    expect(spyPoll).toHaveBeenCalledTimes(1);
    expect(result.authenticationCompleted).toBe(true);
  });

  test("merges StepUpOptions into authentication request params", async () => {
    storeData({ idToken: true });
    const spyRequestChallenge = spyOn(NO_DEFAULT_IDAAS_CLIENT.rba, "requestChallenge").mockResolvedValue(
      interactiveChallenge,
    );

    const apiResponse = createStepUpResponse('Bearer error="insufficient_user_authentication", acr_values="myACR"');

    await NO_DEFAULT_IDAAS_CLIENT.stepUp(apiResponse, {
      preferredAuthenticationMethod: "PASSWORD",
      strict: true,
    });

    const callArgs = spyRequestChallenge.mock.calls[0];
    expect(callArgs).toBeDefined();
    if (!callArgs) {
      throw new Error("requestChallenge was not called");
    }
    const authParams = callArgs[0];
    expect(authParams).toEqual({
      userId: "testingsubclaim",
      preferredAuthenticationMethod: "PASSWORD",
      strict: true,
    });
  });

  test("throws when response has no WWW-Authenticate header", async () => {
    storeData({ idToken: true });

    const apiResponse = new Response(null, { status: 401 });

    expect(async () => {
      await NO_DEFAULT_IDAAS_CLIENT.stepUp(apiResponse);
    }).toThrowError("Response does not contain a WWW-Authenticate header");
  });

  test("throws when WWW-Authenticate error is not a recognized step-up error", async () => {
    storeData({ idToken: true });

    const apiResponse = createStepUpResponse('Bearer error="invalid_token"');

    expect(async () => {
      await NO_DEFAULT_IDAAS_CLIENT.stepUp(apiResponse);
    }).toThrowError('WWW-Authenticate error is "invalid_token"');
  });

  test("handles insufficient_scope error and passes scope to tokenOptions", async () => {
    storeData({ idToken: true });
    const spyRequestChallenge = spyOn(NO_DEFAULT_IDAAS_CLIENT.rba, "requestChallenge").mockResolvedValue(
      interactiveChallenge,
    );

    const apiResponse = createStepUpResponse('Bearer error="insufficient_scope", scope="read write"');

    await NO_DEFAULT_IDAAS_CLIENT.stepUp(apiResponse);

    expect(spyRequestChallenge).toHaveBeenCalledTimes(1);
    const callArgs = spyRequestChallenge.mock.calls[0];
    expect(callArgs).toBeDefined();
    if (!callArgs) {
      throw new Error("requestChallenge was not called");
    }
    const tokenOptions = callArgs[1];
    expect(tokenOptions).toEqual({
      acrValues: undefined,
      maxAge: undefined,
      scope: "read write",
    });
  });

  test("throws when user is not authenticated (no ID token)", async () => {
    const apiResponse = createStepUpResponse('Bearer error="insufficient_user_authentication", acr_values="myACR"');

    expect(async () => {
      await NO_DEFAULT_IDAAS_CLIENT.stepUp(apiResponse);
    }).toThrowError(
      "User is not authenticated. A valid ID token with a sub claim is required for step-up authentication.",
    );
  });
});
