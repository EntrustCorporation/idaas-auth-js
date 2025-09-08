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

// Start with password
document.getElementById("request-challenge")?.addEventListener("click", async () => {
  console.info("Requesting challenge");
  const input = document.getElementById("submit-password-input") as HTMLInputElement;
  const password = input?.value?.trim();
  if (!password) {
    alert("Please enter a password");
    return;
  }
  hideAll();
  try {
    const challengeResponse = await idaasClient.requestChallenge({
      userId: USERNAME,
      password,
    });

    console.log("Challenge response:", challengeResponse);
    updateChallengeUI(challengeResponse);
    if (challengeResponse.pollForCompletion) {
      submitResponse = await idaasClient.pollAuth();
      updateSubmitUI(submitResponse);
    }
    showInputArea();
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
    throw error;
  }
});

// Start without password
document.getElementById("request-challenge-passwordless")?.addEventListener("click", async () => {
  console.info("Requesting challenge without password");
  hideAll();
  try {
    const challengeResponse = await idaasClient.requestChallenge({
      userId: USERNAME,
    });

    console.log("Challenge response:", challengeResponse);
    updateChallengeUI(challengeResponse);
    showInputArea();
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

  if (!code) {
    alert("Please enter a token code");
    return;
  }

  try {
    if (submitResponse?.pollForCompletion) {
      submitResponse = await idaasClient.pollAuth();
    }
    switch (submitResponse?.secondFactorMethod) {
      case "KBA":
        submitResponse = await idaasClient.submitChallenge({
          kbaChallengeAnswers: [code],
        });
        break;
      case "PASSKEY":
      case "FIDO":
        //This is where we'd do passkey, IF THE SDK HANDLED WEBAUTHN
        break;
      default:
        console.log("password submit");
        submitResponse = await idaasClient.submitChallenge({
          response: code,
        });
        updateSubmitUI(submitResponse);
        if (submitResponse.pollForCompletion) {
          submitResponse = await idaasClient.pollAuth();
        }
    }

    console.log("Submit response:", submitResponse);
    updateSubmitUI(submitResponse);
    input.value = "";
    return submitResponse;
  } catch (error) {
    console.error("Submit challenge failed:", error);
    updateSubmitUI(null, error);
  }
  hideInputArea();
  hideMutualAuthChallenge();
  showPassword();
});

// Token Push
document.getElementById("request-challenge-token-push")?.addEventListener("click", async () => {
  hideAll();
  try {
    const challengeResponse = await idaasClient.requestChallenge({
      userId: USERNAME,
      preferredAuthenticationMethod: "TOKENPUSH",
      strict: true,
    });

    console.log("Challenge response:", challengeResponse);
    updateChallengeUI(challengeResponse);
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
  try {
    const submitResponse = await idaasClient.pollAuth();
    updateSubmitUI(submitResponse);
  } catch (error) {
    console.error("Polling failed:", error);
    updateSubmitUI(null, error);
  }
});

// Token Push with Mutual Auth
document.getElementById("request-challenge-token-push-mutual")?.addEventListener("click", async () => {
  console.info("Requesting token push with mutual auth challenge");
  hideAll();
  try {
    const challengeResponse = await idaasClient.requestChallenge({
      userId: USERNAME,
      preferredAuthenticationMethod: "TOKENPUSH",
      strict: true,
      tokenPushOptions: { mutualChallengeEnabled: true },
    });

    console.log("Challenge response:", challengeResponse);
    showMutualAuthChallenge(challengeResponse.pushMutualChallenge);
    updateChallengeUI(challengeResponse);
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }

  try {
    const submitResponse = await idaasClient.pollAuth();
    updateSubmitUI(submitResponse);
  } catch (error) {
    console.error("Polling failed:", error);
    updateSubmitUI(null, error);
  }
  hideMutualAuthChallenge();
});

// Cancel Auth handler
document.getElementById("cancel-auth")?.addEventListener("click", async () => {
  showPassword();
  await handleCancelAuth();
});

const showMutualAuthChallenge = (mutualAuthCode: string | null) => {
  const codeArea = document.getElementById("mutual-auth-challenge");
  const codeElement = document.getElementById("mutual-auth-code");
  if (codeArea) {
    codeArea.style.display = "block";
  }
  if (codeElement) {
    codeElement.textContent = mutualAuthCode;
  }
};

const hideMutualAuthChallenge = () => {
  const inputArea = document.getElementById("mutual-auth-challenge");
  if (inputArea) {
    inputArea.style.display = "none";
  }
};

const hideResponse = () => {
  const challengeArea = document.getElementById("request-challenge-response");
  const submitArea = document.getElementById("submit-challenge-response");
  if (challengeArea) {
    challengeArea.style.display = "none";
  }
  if (submitArea) {
    submitArea.style.display = "none";
  }
};

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

const hideAll = () => {
  hideInputArea();
  hideMutualAuthChallenge();
  hideResponse();
  hidePassword();
};

// Back button
document.getElementById("back-button")?.addEventListener("click", async () => {
  window.location.href = "../index.html";
});

window.addEventListener("load", async () => {
  console.log("RBA/MFA page loaded");
});
