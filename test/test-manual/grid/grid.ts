import type { GridChallengeCell } from "../../../src/models/openapi-ts";
import {
  hideInputArea,
  hideResponse,
  idaasClient,
  showInputArea,
  USERNAME,
  updateChallengeUI,
  updateSubmitUI,
} from "../shared-utils";

// Grid
document.getElementById("request-challenge-grid")?.addEventListener("click", async () => {
  console.info("Requesting GRID challenge");
  hideInputArea();
  hideResponse();

  try {
    const challengeResponse = await idaasClient.auth.grid(USERNAME);

    console.log("Challenge response:", challengeResponse);
    updateGridUI(challengeResponse.gridChallenge?.challenge || []);
    updateChallengeUI(challengeResponse);
    showInputArea();
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
});

// Submit Handler
document.getElementById("submit-response")?.addEventListener("click", async () => {
  console.info("Submitting GRID response");

  const input = document.getElementById("submit-response-input") as HTMLInputElement;
  const code = input?.value?.trim();

  if (!code) {
    alert("Please enter a GRID code");
    return;
  }

  try {
    const submitResponse = await idaasClient.auth.submit({
      response: code,
    });

    console.log("Submit response:", submitResponse);
    updateSubmitUI(submitResponse);
    input.value = "";
  } catch (error) {
    console.error("Submit challenge failed:", error);
    updateSubmitUI(null, error);
  }
  hideInputArea();
});

// Back button
document.getElementById("back-button")?.addEventListener("click", async () => {
  window.location.href = "../index.html";
});

window.addEventListener("load", async () => {
  console.log("Grid page loaded");
});

const updateGridUI = (challenge: Array<GridChallengeCell>) => {
  const container = document.getElementById("grid-container");
  const challengePre = document.getElementById("grid-challenge");

  if (container && challengePre) {
    container.style.display = "block";
    challengePre.textContent = challenge.map((cell) => `row:${cell.row} col:${cell.column}`).join("\n");
  }
};
