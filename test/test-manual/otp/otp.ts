import {
  hideInputArea,
  hideResponse,
  idaasClient,
  showInputArea,
  USERNAME,
  updateChallengeUI,
  updateSubmitUI,
} from "../shared-utils";

// OTP
document.getElementById("request-challenge-otp")?.addEventListener("click", async () => {
  console.info("Requesting OTP challenge");
  hideInputArea();
  hideResponse();

  try {
    const challengeResponse = await idaasClient.auth.authenticateOtp(USERNAME);

    console.log("Challenge response:", challengeResponse);
    updateChallengeUI(challengeResponse);
    showInputArea();
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
});

// OTP Email
document.getElementById("request-challenge-otp-email")?.addEventListener("click", async () => {
  console.info("Requesting OTP challenge");
  hideInputArea();
  hideResponse();

  try {
    const challengeResponse = await idaasClient.auth.authenticateOtp(USERNAME, "EMAIL");

    console.log("Challenge response:", challengeResponse);
    updateChallengeUI(challengeResponse);
    showInputArea();
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
});

// OTP SMS
document.getElementById("request-challenge-otp-sms")?.addEventListener("click", async () => {
  console.info("Requesting OTP challenge");
  hideInputArea();
  hideResponse();

  try {
    const challengeResponse = await idaasClient.auth.authenticateOtp(USERNAME, "SMS");

    console.log("Challenge response:", challengeResponse);
    updateChallengeUI(challengeResponse);
    showInputArea();
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
});

// OTP Voice
document.getElementById("request-challenge-otp-voice")?.addEventListener("click", async () => {
  console.info("Requesting OTP challenge");
  hideInputArea();
  hideResponse();

  try {
    const challengeResponse = await idaasClient.auth.authenticateOtp(USERNAME, "VOICE");

    console.log("Challenge response:", challengeResponse);
    updateChallengeUI(challengeResponse);
    showInputArea();
  } catch (error) {
    console.error("Request challenge failed:", error);
    updateChallengeUI(null, error);
  }
});

// Submit Handler
document.getElementById("submit-response")?.addEventListener("click", async () => {
  console.info("Submitting OTP response");

  const input = document.getElementById("submit-response-input") as HTMLInputElement;
  const code = input?.value?.trim();

  if (!code) {
    alert("Please enter an OTP code");
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
  console.log("OTP page loaded");
});
