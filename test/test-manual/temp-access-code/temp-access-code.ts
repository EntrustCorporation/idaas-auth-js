import { hideInputArea, idaasClient, USERNAME, updateSubmitUI } from "../shared-utils";

// Submit Handler
document.getElementById("submit-response")?.addEventListener("click", async () => {
  console.info("Submitting authentication request");

  const tacInput = document.getElementById("submit-temp-access-code-input") as HTMLInputElement;
  const tempAccessCode = tacInput?.value?.trim();

  if (!tempAccessCode) {
    alert("Please enter a temporary access code");
    return;
  }

  try {
    const submitResponse = await idaasClient.auth.tempAccessCode(USERNAME, tempAccessCode);

    console.log("Submit response:", submitResponse);
    updateSubmitUI(submitResponse);
    tacInput.value = "";
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
  console.log("Temporary Access Code page loaded");
});
