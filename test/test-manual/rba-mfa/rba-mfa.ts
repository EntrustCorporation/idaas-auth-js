import type { AuthenticationResponse } from "../../../src/models";
import {
  handleCancelAuth,
  hideInputArea,
  idaasClient,
  showInputArea,
  USERNAME,
  updateChallengeUI,
  updateSubmitUI,
} from "../shared-utils";

let submitResponse: AuthenticationResponse;
let challengeResponse: AuthenticationResponse;

// Request challenge with password
document.getElementById("request-challenge-password")?.addEventListener("click", async () => {
  console.info("Requesting challenge");
  const input = document.getElementById("request-challenge-password-input") as HTMLInputElement;
  const password = input?.value?.trim();
  if (!password) {
    alert("Please enter a password");
    return;
  }

  hideRequestChallengeArea();

  try {
    challengeResponse = await idaasClient.rba.requestChallenge({
      userId: USERNAME,
      password,
    });

    console.log("Challenge response:", challengeResponse);
    updateChallengeUI(challengeResponse);
    if (challengeResponse.pollForCompletion) {
      submitResponse = await idaasClient.rba.poll();
      updateSubmitUI(submitResponse);
    } else if (challengeResponse.secondFactorMethod === "PASSKEY" || challengeResponse.secondFactorMethod === "FIDO") {
      const publicKeyCredential = (await navigator.credentials.get({
        publicKey: challengeResponse.publicKeyCredentialRequestOptions,
      })) as PublicKeyCredential;
      if (publicKeyCredential) {
        submitResponse = await idaasClient.rba.submitChallenge({
          publicKeyCredential,
        });
      }
      updateSubmitUI(submitResponse);
    } else {
      hideRequestChallengeArea();
      showInputArea();
    }
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
    throw error;
  }
});

// Request challenge without password
document.getElementById("request-challenge-passwordless")?.addEventListener("click", async () => {
  console.info("Requesting challenge without password");
  showPassword();
  try {
    challengeResponse = await idaasClient.rba.requestChallenge({
      userId: USERNAME,
    });

    console.log("Challenge response:", challengeResponse);
    updateChallengeUI(challengeResponse);
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
    throw error;
  }
});

// Submit Handler
document.getElementById("submit-response")?.addEventListener("click", async () => {
  console.info("Submitting response");
  const input = document.getElementById("submit-response-input") as HTMLInputElement;
  const code = input?.value?.trim();
  let response: AuthenticationResponse;
  if (!code) {
    alert("Please enter a code");
    return;
  }

  hideInputArea();
  if (submitResponse) {
    response = submitResponse;
  } else {
    response = challengeResponse;
  }

  if (!response) {
    alert("No challenge to respond to");
    return;
  }

  try {
    if (response.secondFactorMethod === "KBA") {
      submitResponse = await idaasClient.rba.submitChallenge({
        kbaChallengeAnswers: [code],
      });
    } else {
      submitResponse = await idaasClient.rba.submitChallenge({
        response: code,
      });
    }
    updateSubmitUI(submitResponse);
  } catch (error) {
    console.error("Submit challenge failed:", error);
    updateSubmitUI(null, error);
  }
});

// Submit Password Handler
document.getElementById("submit-password-response")?.addEventListener("click", async () => {
  console.info("Submitting password");
  const input = document.getElementById("submit-password-input") as HTMLInputElement;
  const password = input?.value?.trim();

  if (!password) {
    alert("Please enter a password");
    return;
  }

  hidePassword();

  try {
    submitResponse = await idaasClient.rba.submitChallenge({
      response: password,
    });
    console.log("Submit response:", submitResponse);
    updateSubmitUI(submitResponse);
    if (submitResponse.pollForCompletion) {
      submitResponse = await idaasClient.rba.poll();
      updateSubmitUI(submitResponse);
    } else if (submitResponse.secondFactorMethod === "PASSKEY" || submitResponse.secondFactorMethod === "FIDO") {
      const publicKeyCredential = (await navigator.credentials.get({
        publicKey: submitResponse.publicKeyCredentialRequestOptions,
      })) as PublicKeyCredential;
      if (publicKeyCredential) {
        submitResponse = await idaasClient.rba.submitChallenge({
          publicKeyCredential,
        });
      }
      updateSubmitUI(submitResponse);
    } else {
      showInputArea();
    }
  } catch (error) {
    console.error("Submit password failed:", error);
    updateSubmitUI(null, error);
  }
});

// Cancel Auth handler
document.getElementById("cancel-auth")?.addEventListener("click", async () => {
  showRequestChallengeArea();
  await handleCancelAuth();
});

const hidePassword = () => {
  const passwordArea = document.getElementById("submit-password-area");
  if (passwordArea) {
    passwordArea.style.display = "none";
  }
};

const showPassword = () => {
  const passwordArea = document.getElementById("submit-password-area");
  if (passwordArea) {
    passwordArea.style.display = "block";
  }
};

const hideRequestChallengeArea = () => {
  const requestChallengeArea = document.getElementById("request-challenge-area");
  if (requestChallengeArea) {
    requestChallengeArea.style.display = "none";
  }
};

const showRequestChallengeArea = () => {
  const requestChallengeArea = document.getElementById("request-challenge-area");
  if (requestChallengeArea) {
    requestChallengeArea.style.display = "block";
  }
};

// Back button
document.getElementById("back-button")?.addEventListener("click", async () => {
  window.location.href = "../index.html";
});

window.addEventListener("load", async () => {
  console.log("RBA-MFA page loaded");
});
