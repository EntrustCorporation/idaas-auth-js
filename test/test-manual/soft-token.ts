/** biome-ignore-all lint/suspicious/noExplicitAny: Test responses */
import { IdaasClient } from "../../src";

const CLIENT_ID = "07b9d9ad-4f46-4069-8311-76b8c24550a7";
const ISSUER = "https://entrust-bank.us.trustedauth.com/api/oidc";
const USERNAME = "";

const initializeClient = () => {
  console.log(`Initializing client with issuer ${ISSUER}`);

  return new IdaasClient({
    issuerUrl: ISSUER,
    clientId: CLIENT_ID,
    storageType: "localstorage",
  });
};

const idaasClient: IdaasClient = initializeClient();

// Token
document.getElementById("request-challenge-token")?.addEventListener("click", async () => {
  console.info("Requesting token challenge");
  hideInputArea();
  hideResponse();

  try {
    const challengeResponse = await idaasClient.requestChallenge({
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
  }
});

// Token Push
document.getElementById("request-challenge-token-push")?.addEventListener("click", async () => {
  console.info("Requesting token push challenge");
  hideResponse();
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
  hideInputArea();
  hideResponse();
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
});

// Submit Handler
document.getElementById("submit-response")?.addEventListener("click", async () => {
  console.info("Submitting token response");

  const tokenInput = document.getElementById("submit-response-input") as HTMLInputElement;
  const tokenCode = tokenInput?.value?.trim();

  if (!tokenCode) {
    alert("Please enter a token code");
    return;
  }

  try {
    const submitResponse = await idaasClient.submitChallenge({
      response: tokenCode,
    });

    console.log("Submit response:", submitResponse);
    updateSubmitUI(submitResponse);
    tokenInput.value = "";
    hideInputArea();
  } catch (error) {
    console.error("Submit challenge failed:", error);
    updateSubmitUI(null, error);
  }
});

// Poll Auth handler
document.getElementById("poll-auth")?.addEventListener("click", async () => {
  console.info("Polling authentication status");

  try {
    const pollResponse = await idaasClient.pollAuth();
    console.log("Poll response:", pollResponse);
    updateSubmitUI(pollResponse);
  } catch (error) {
    console.error("Poll auth failed:", error);
    updateSubmitUI(null, error);
  }
});

// Cancel Auth handler
document.getElementById("cancel-auth")?.addEventListener("click", async () => {
  console.info("Canceling auth request");
  hideResponse();
  hideInputArea();
  hideMutualAuthChallenge();
  try {
    await idaasClient.cancelAuth();
    console.log("Authentication cancelled");
    updateChallengeUI({ status: "cancelled" });
  } catch (error) {
    console.error("Cancel auth failed:", error);
    updateChallengeUI(null, error);
  }
});

// UI Helper functions
const showInputArea = () => {
  const inputArea = document.getElementById("submit-input-area");
  if (inputArea) {
    inputArea.style.display = "block";
  }
};

const hideInputArea = () => {
  const inputArea = document.getElementById("submit-input-area");
  if (inputArea) {
    inputArea.style.display = "none";
  }
};

const showMutualAuthChallenge = (mutualAuthCode) => {
  const inputArea = document.getElementById("mutual-auth-challenge");
  const codeElement = document.getElementById("mutual-auth-code");
  if (inputArea) {
    inputArea.style.display = "block";
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

const updateChallengeUI = (response: any, error?: any) => {
  const resultDiv = document.getElementById("request-challenge-response");
  const outputElement = document.getElementById("challenge-output");

  if (!resultDiv || !outputElement) return;

  resultDiv.style.display = "block";

  if (error) {
    outputElement.textContent = `Error: ${error.message || error}`;
    outputElement.style.color = "red";
  } else {
    outputElement.textContent = JSON.stringify(response, null, 2);
    outputElement.style.color = "black";
  }
};

const updateSubmitUI = (response: any, error?: any) => {
  const resultDiv = document.getElementById("submit-challenge-response");
  const outputElement = document.getElementById("submit-output");

  if (!resultDiv || !outputElement) return;

  resultDiv.style.display = "block";

  if (error) {
    outputElement.textContent = `Error: ${error.message || error}`;
    outputElement.style.color = "red";
  } else {
    outputElement.textContent = JSON.stringify(response, null, 2);
    outputElement.style.color = "black";
  }

  hideMutualAuthChallenge();
};

window.addEventListener("load", async () => {
  console.log("Soft token page loaded");
});
