import { hideInputArea, idaasClient, updateSubmitUI } from "../shared-utils";

// Submit Handler
document.getElementById("submit-response")?.addEventListener("click", async () => {
  console.info("Submitting authentication request");

  const userIdInput = document.getElementById("submit-username-input") as HTMLInputElement;
  const passwordInput = document.getElementById("submit-password-input") as HTMLInputElement;
  const userId = userIdInput?.value?.trim();
  const password = passwordInput?.value?.trim();

  if (!password || !userId) {
    alert("Please enter a user ID and password");
    return;
  }

  try {
    const submitResponse = await idaasClient.auth.password(userId, password);

    console.log("Submit response:", submitResponse);
    updateSubmitUI(submitResponse);
    userIdInput.value = "";
    passwordInput.value = "";
    return submitResponse;
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
  console.log("Password page loaded");
});
