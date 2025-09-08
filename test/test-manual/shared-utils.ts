/** biome-ignore-all lint/suspicious/noExplicitAny: Test responses */
import { IdaasClient } from "../../src";

const CLIENT_ID = "07b9d9ad-4f46-4069-8311-76b8c24550a7";
const ISSUER = "https://entrust-bank.us.trustedauth.com/api/oidc";
export const USERNAME = "porya.isfahani@entrust.com";

export const idaasClient = new IdaasClient({
  issuerUrl: ISSUER,
  clientId: CLIENT_ID,
  storageType: "localstorage",
});

// UI Helper functions
export const showInputArea = () => {
  const inputArea = document.getElementById("submit-input-area");
  if (inputArea) {
    inputArea.style.display = "block";
  }
};

export const hideInputArea = () => {
  const inputArea = document.getElementById("submit-input-area");
  if (inputArea) {
    inputArea.style.display = "none";
  }
};

export const hideResponse = () => {
  const challengeArea = document.getElementById("request-challenge-response");
  const submitArea = document.getElementById("submit-challenge-response");
  if (challengeArea) {
    challengeArea.style.display = "none";
  }
  if (submitArea) {
    submitArea.style.display = "none";
  }
};

export const updateChallengeUI = (response: any, error?: any) => {
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

export const updateSubmitUI = (response: any, error?: any) => {
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
};

// Common cancel handler
export const handleCancelAuth = async () => {
  console.info("Canceling auth request");
  hideResponse();
  hideInputArea();

  try {
    await idaasClient.cancelAuth();
    console.log("Authentication cancelled");
    updateChallengeUI({ status: "cancelled" });
  } catch (error) {
    console.error("Cancel auth failed:", error);
    updateChallengeUI(null, error);
    throw error;
  }
};
