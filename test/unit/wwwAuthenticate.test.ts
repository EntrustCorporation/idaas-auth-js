import { describe, expect, it } from "bun:test";
import { parseStepUpChallenge } from "../../src/utils/wwwAuthenticate";

describe("parseStepUpChallenge", () => {
  it("parses acr_values from a step-up challenge header", () => {
    const header = 'Bearer error="insufficient_user_authentication", acr_values="myACR"';
    const result = parseStepUpChallenge(header);

    expect(result.acrValues).toEqual(["myACR"]);
    expect(result.maxAge).toBeUndefined();
    expect(result.scope).toBeUndefined();
  });

  it("parses multiple space-separated acr_values", () => {
    const header = 'Bearer error="insufficient_user_authentication", acr_values="urn:acr:bronze urn:acr:silver"';
    const result = parseStepUpChallenge(header);

    expect(result.acrValues).toEqual(["urn:acr:bronze", "urn:acr:silver"]);
  });

  it("parses max_age from a step-up challenge header", () => {
    const header = 'Bearer error="insufficient_user_authentication", max_age="300"';
    const result = parseStepUpChallenge(header);

    expect(result.maxAge).toBe(300);
    expect(result.acrValues).toBeUndefined();
  });

  it("parses max_age of 0", () => {
    const header = 'Bearer error="insufficient_user_authentication", max_age="0"';
    const result = parseStepUpChallenge(header);

    expect(result.maxAge).toBe(0);
  });

  it("parses both acr_values and max_age", () => {
    const header = 'Bearer error="insufficient_user_authentication", acr_values="myACR", max_age="5"';
    const result = parseStepUpChallenge(header);

    expect(result.acrValues).toEqual(["myACR"]);
    expect(result.maxAge).toBe(5);
  });

  it("parses scope from the challenge header", () => {
    const header = 'Bearer error="insufficient_user_authentication", acr_values="myACR", scope="openid profile"';
    const result = parseStepUpChallenge(header);

    expect(result.acrValues).toEqual(["myACR"]);
    expect(result.scope).toBe("openid profile");
  });

  it("parses error_description", () => {
    const header =
      'Bearer error="insufficient_user_authentication", error_description="A different authentication level is required", acr_values="myACR"';
    const result = parseStepUpChallenge(header);

    expect(result.errorDescription).toBe("A different authentication level is required");
    expect(result.acrValues).toEqual(["myACR"]);
  });

  it("parses unquoted token values with RFC 9110 token characters", () => {
    const header = 'Bearer error="insufficient_scope", error_description=step-up!, scope=read';
    const result = parseStepUpChallenge(header);

    expect(result.errorDescription).toBe("step-up!");
    expect(result.scope).toBe("read");
  });

  it("parses quoted-string values with escaped characters", () => {
    const header =
      'Bearer error="insufficient_user_authentication", error_description="Need \\"MFA\\", now", acr_values="myACR"';
    const result = parseStepUpChallenge(header);

    expect(result.errorDescription).toBe('Need "MFA", now');
    expect(result.acrValues).toEqual(["myACR"]);
  });

  it("parses all parameters together", () => {
    const header =
      'Bearer error="insufficient_user_authentication", error_description="Step up required", acr_values="urn:acr:mfa", max_age="60", scope="openid transactions"';
    const result = parseStepUpChallenge(header);

    expect(result.acrValues).toEqual(["urn:acr:mfa"]);
    expect(result.maxAge).toBe(60);
    expect(result.scope).toBe("openid transactions");
    expect(result.errorDescription).toBe("Step up required");
  });

  it("handles unquoted parameter values", () => {
    const header = "Bearer error=insufficient_user_authentication, acr_values=myACR, max_age=10";
    const result = parseStepUpChallenge(header);

    expect(result.acrValues).toEqual(["myACR"]);
    expect(result.maxAge).toBe(10);
  });

  it("throws when the header does not use the Bearer scheme", () => {
    expect(() => {
      parseStepUpChallenge('Basic realm="example"');
    }).toThrowError("WWW-Authenticate header does not use the Bearer scheme");
  });

  it("throws when the error is not a recognized step-up error", () => {
    expect(() => {
      parseStepUpChallenge('Bearer error="invalid_token"');
    }).toThrowError(
      'WWW-Authenticate error is "invalid_token", expected one of: "insufficient_user_authentication", "insufficient_scope"',
    );
  });

  it("throws when no error parameter is present", () => {
    expect(() => {
      parseStepUpChallenge('Bearer realm="example"');
    }).toThrowError(
      'WWW-Authenticate error is "", expected one of: "insufficient_user_authentication", "insufficient_scope"',
    );
  });

  it("throws when max_age is not a valid non-negative integer", () => {
    expect(() => {
      parseStepUpChallenge('Bearer error="insufficient_user_authentication", max_age="abc"');
    }).toThrowError('Invalid max_age value: "abc"');
  });

  it("throws when max_age contains trailing characters", () => {
    expect(() => {
      parseStepUpChallenge('Bearer error="insufficient_user_authentication", max_age="10abc"');
    }).toThrowError('Invalid max_age value: "10abc"');
  });

  it("throws when max_age includes a plus sign", () => {
    expect(() => {
      parseStepUpChallenge('Bearer error="insufficient_user_authentication", max_age="+5"');
    }).toThrowError('Invalid max_age value: "+5"');
  });

  it("throws when max_age is a decimal string", () => {
    expect(() => {
      parseStepUpChallenge('Bearer error="insufficient_user_authentication", max_age="5.0"');
    }).toThrowError('Invalid max_age value: "5.0"');
  });

  it("throws when max_age is negative", () => {
    expect(() => {
      parseStepUpChallenge('Bearer error="insufficient_user_authentication", max_age="-1"');
    }).toThrowError('Invalid max_age value: "-1"');
  });

  it("is case-insensitive for the Bearer scheme", () => {
    const header = 'bearer error="insufficient_user_authentication", acr_values="myACR"';
    const result = parseStepUpChallenge(header);

    expect(result.acrValues).toEqual(["myACR"]);
  });

  it("parses Bearer headers with leading whitespace", () => {
    const header = '  Bearer error="insufficient_scope", scope="read write"';
    const result = parseStepUpChallenge(header);

    expect(result.scope).toBe("read write");
  });

  it("handles extra whitespace between parameters", () => {
    const header = 'Bearer   error="insufficient_user_authentication",   acr_values="myACR",   max_age="30"';
    const result = parseStepUpChallenge(header);

    expect(result.acrValues).toEqual(["myACR"]);
    expect(result.maxAge).toBe(30);
  });

  it("parses insufficient_scope error with required scopes", () => {
    const header = 'Bearer error="insufficient_scope", scope="read write"';
    const result = parseStepUpChallenge(header);

    expect(result.scope).toBe("read write");
    expect(result.acrValues).toBeUndefined();
    expect(result.maxAge).toBeUndefined();
  });

  it("parses insufficient_scope error with error_description", () => {
    const header =
      'Bearer error="insufficient_scope", error_description="Token lacks required privileges", scope="openid transactions"';
    const result = parseStepUpChallenge(header);

    expect(result.scope).toBe("openid transactions");
    expect(result.errorDescription).toBe("Token lacks required privileges");
  });
});
