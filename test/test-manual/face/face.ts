import { handleCancelAuth, idaasClient, USERNAME, updateChallengeUI, updateSubmitUI } from "../shared-utils";

// Face
document.getElementById("request-challenge-face")?.addEventListener("click", async () => {
  hideResponse();
  hideMutualAuthChallenge();
  try {
    const challengeResponse = await idaasClient.auth.authenticateFaceBiometric(USERNAME);

    console.log("Challenge response:", challengeResponse);
    updateSubmitUI(challengeResponse);
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
});

// Face mobile with mutual
document.getElementById("request-challenge-face-mobile-mutual")?.addEventListener("click", async () => {
  hideResponse();
  console.log("Requesting Face Mobile with Mutual Auth challenge");
  try {
    const challengeResponse = await idaasClient.auth.authenticateFaceBiometric(USERNAME, { mutualChallenge: true });
    console.log("Challenge response:", challengeResponse);
    showMutualAuthChallenge(challengeResponse.pushMutualChallenge || "");
    updateChallengeUI(challengeResponse);
    const submitResponse = await idaasClient.auth.poll();
    updateSubmitUI(submitResponse);
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

const showMutualAuthChallenge = (mutualAuthCode: string) => {
  console.log("showMutualAuthChallenge called with code:", mutualAuthCode);
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

// Back button
document.getElementById("back-button")?.addEventListener("click", async () => {
  window.location.href = "../index.html";
});

window.addEventListener("load", async () => {
  console.log("Face page loaded");
});
