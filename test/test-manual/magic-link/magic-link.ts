import { handleCancelAuth, idaasClient, USERNAME, updateChallengeUI, updateSubmitUI } from "../shared-utils";

// Magic Link
document.getElementById("request-challenge-token")?.addEventListener("click", async () => {
  hideResponse();
  try {
    const challengeResponse = await idaasClient.auth.magicLink(USERNAME);

    console.log("Challenge response:", challengeResponse);
    updateSubmitUI(challengeResponse);
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
});

// Cancel Auth handler
document.getElementById("cancel-auth")?.addEventListener("click", async () => {
  await handleCancelAuth();
});

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

// Back button
document.getElementById("back-button")?.addEventListener("click", async () => {
  window.location.href = "../index.html";
});

window.addEventListener("load", async () => {
  console.log("Magic link page loaded");
});
