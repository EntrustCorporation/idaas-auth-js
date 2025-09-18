import {
  handleCancelAuth,
  hideInputArea,
  idaasClient,
  showInputArea,
  USERNAME,
  updateChallengeUI,
  updateSubmitUI,
} from "../shared-utils";

// Token
document.getElementById("request-challenge-token")?.addEventListener("click", async () => {
  console.info("Requesting Soft Token challenge");
  hideAll();

  try {
    const challengeResponse = await idaasClient.rba.requestChallenge({
      userId: USERNAME,
      preferredAuthenticationMethod: "TOKEN",
      strict: true,
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

// Token Push
document.getElementById("request-challenge-token-push")?.addEventListener("click", async () => {
  hideAll();
  try {
    const challengeResponse = await idaasClient.rba.requestChallenge({
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
    const submitResponse = await idaasClient.rba.poll();
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
    const challengeResponse = await idaasClient.rba.requestChallenge({
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
    const submitResponse = await idaasClient.rba.poll();
    updateSubmitUI(submitResponse);
  } catch (error) {
    console.error("Polling failed:", error);
    updateSubmitUI(null, error);
  }
  hideMutualAuthChallenge();
});

// Submit Handler
document.getElementById("submit-response")?.addEventListener("click", async () => {
  console.info("Submitting Soft Token response");

  const input = document.getElementById("submit-response-input") as HTMLInputElement;
  const code = input?.value?.trim();

  if (!code) {
    alert("Please enter a token code");
    return;
  }

  try {
    const submitResponse = await idaasClient.rba.submitChallenge({
      response: code,
    });

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
});

// Cancel Auth handler
document.getElementById("cancel-auth")?.addEventListener("click", async () => {
  await handleCancelAuth();
});

const showMutualAuthChallenge = (mutualAuthCode) => {
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

const hideAll = () => {
  hideInputArea();
  hideMutualAuthChallenge();
  hideResponse();
};

// Back button
document.getElementById("back-button")?.addEventListener("click", async () => {
  window.location.href = "../index.html";
});

window.addEventListener("load", async () => {
  console.log("Soft token page loaded");
});
