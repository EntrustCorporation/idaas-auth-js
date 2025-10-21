import type { UserQuestion } from "../../../src/models/openapi-ts";
import {
  hideInputArea,
  hideResponse,
  idaasClient,
  showInputArea,
  USERNAME,
  updateChallengeUI,
  updateSubmitUI,
} from "../shared-utils";

// KBA
document.getElementById("request-challenge-kba")?.addEventListener("click", async () => {
  console.info("Requesting KBA challenge");
  hideInputArea();
  hideResponse();

  try {
    const challengeResponse = await idaasClient.auth.authenticateKba(USERNAME);

    console.log("Challenge response:", challengeResponse);
    updateKbaUI(challengeResponse.kbaChallenge?.userQuestions || []);
    updateChallengeUI(challengeResponse);
    showInputArea();
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
});

// Submit Handler
document.getElementById("submit-response")?.addEventListener("click", async () => {
  console.info("Submitting KBA response");

  const input = document.getElementById("submit-response-input") as HTMLInputElement;
  const code = input?.value?.trim();

  if (!code) {
    alert("Please enter a KBA code");
    return;
  }

  const kbaAnswers = code
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  try {
    const submitResponse = await idaasClient.auth.submit({
      kbaChallengeAnswers: kbaAnswers,
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
  console.log("KBA page loaded");
});

const updateKbaUI = (challenge: Array<UserQuestion>) => {
  const container = document.getElementById("kba-container");
  const challengePre = document.getElementById("kba-challenge");
  console.log(challenge);

  if (container && challengePre) {
    container.style.display = "block";
    challengePre.textContent = challenge.map((cell) => `${cell.question}`).join("\n");
  }
};
