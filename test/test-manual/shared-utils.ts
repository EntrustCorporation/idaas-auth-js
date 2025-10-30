/** biome-ignore-all lint/suspicious/noExplicitAny: Test responses */
import { IdaasClient } from "../../src";
import { STORAGE_KEYS } from "./constants";

const getRequiredConfigValue = (key: string, label: string) => {
  const value = window.localStorage.getItem(key)?.trim();
  if (!value) {
    alert(`Missing ${label}. You will be redirected to http://localhost:8080/ to configure it.`);
    window.location.href = "http://localhost:8080/";
    throw new Error(`Missing ${label}. Please configure it on the manual testing landing page.`);
  }
  return value;
};

const getConfig = () => ({
  issuerUrl: getRequiredConfigValue(STORAGE_KEYS.issuer, "Issuer URL"),
  clientId: getRequiredConfigValue(STORAGE_KEYS.clientId, "Client ID"),
  username: getRequiredConfigValue(STORAGE_KEYS.username, "Username"),
});

const config = getConfig();

export const USERNAME = config.username;

export const idaasClient = new IdaasClient({
  issuerUrl: config.issuerUrl,
  clientId: config.clientId,
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
    await idaasClient.rba.cancel();
    console.log("Authentication cancelled");
    updateChallengeUI({ status: "cancelled" });
  } catch (error) {
    console.error("Cancel auth failed:", error);
    updateChallengeUI(null, error);
    throw error;
  }
};
