import { hideResponse, idaasClient, updateChallengeUI, updateSubmitUI } from "../shared-utils";

// Passkey
document.getElementById("request-challenge-passkey")?.addEventListener("click", async () => {
  const input = document.getElementById("request-challenge-userid-input") as HTMLInputElement;
  const userId = input?.value?.trim();
  if (userId) {
    console.info("Requesting FIDO challenge");
  } else {
    console.info("Requesting PASSKEY challenge");
  }
  hideResponse();

  try {
    const challengeResponse = await idaasClient.auth.passkey(userId);

    console.log("Challenge response:", challengeResponse);
    updateSubmitUI(challengeResponse);
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
});

// Back button
document.getElementById("back-button")?.addEventListener("click", async () => {
  window.location.href = "../index.html";
});

window.addEventListener("load", async () => {
  console.log("Passkey page loaded");
});

/* -------- Passkey enrollment helpers -------- */

document.getElementById("enroll-passkey")?.addEventListener("click", async () => {
  const baseUrlInput = document.getElementById("enrollment-base-url-input") as HTMLInputElement;
  const authHeaderInput = document.getElementById("enrollment-authorization-input") as HTMLInputElement;
  const userIdInput = document.getElementById("enrollment-user-id-input") as HTMLInputElement;

  const userId = userIdInput?.value?.trim();
  const baseUrl = baseUrlInput?.value?.trim();
  const authHeader = authHeaderInput?.value?.trim();

  if (!userId || !baseUrl || !authHeader) {
    alert("Please enter a user ID, base URL, and authorization header to enroll a passkey.");
    return;
  }

  try {
    await registerPasskey(userId, baseUrl, authHeader);
  } catch (e) {
    console.error("Enrollment failed:", e);
    alert("Enrollment failed. See console for details.");
  }
});

export const extractAndEncodePayload = (credential: PublicKeyCredential) => {
  const payload = {
    id: base64UrlEncode(credential.rawId),
    type: credential.type,
  };

  for (const key in credential.response) {
    // @ts-expect-error  limited Credential typings
    payload[key] = base64UrlEncode(credential.response[key]);
  }

  return payload;
};

export const base64UrlEncode = (value: ArrayBuffer) => {
  return btoa(Array.from(new Uint8Array(value), (b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const isPublicKeyCredential = (credential: Credential | null): credential is PublicKeyCredential => {
  return (
    credential !== null &&
    credential.type === "public-key" &&
    (credential as PublicKeyCredential).response !== undefined
  );
};

const registerPasskey = async (userId: string, baseUrl: string, authHeader: string): Promise<void> => {
  const something = await fetch(`${baseUrl}/api/web/v3/users/userid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ userId: userId }),
  });
  const { id } = await something.json();
  const response = await fetch(`${baseUrl}/api/web/v1/fidotokens/challenge/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
  });

  const credentialRequest = await response.json();

  // Helper to convert base64url -> BufferSource
  const b64urlToUint8Array = (b64url: string): BufferSource => {
    let base64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: b64urlToUint8Array(credentialRequest.challenge),
    rp: {
      name: credentialRequest.rpName,
      id: window.location.hostname,
    },
    user: {
      id: b64urlToUint8Array(credentialRequest.userId),
      name: credentialRequest.userName,
      displayName: credentialRequest.userDisplayName,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    timeout: credentialRequest.timeoutMillis,
    authenticatorSelection: {
      residentKey:
        credentialRequest.registrationRequireResidentKey?.toLowerCase() === "required" ? "required" : "preferred",
      userVerification:
        credentialRequest.registrationUserVerification?.toLowerCase() === "required" ? "required" : "preferred",
    },
    attestation: "none",
  };
  const rawCredential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
  if (!isPublicKeyCredential(rawCredential)) {
    throw new Error("Failed to create public key credential.");
  }
  const credential = extractAndEncodePayload(rawCredential);

  await fetch(`${baseUrl}/api/web/v1/fidotokens/complete/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      attestationObject: credential.attestationObject,
      clientDataJSON: credential.clientDataJSON,
      name: "Test",
    }),
  });
};
