import { STORAGE_KEYS } from "./constants";

const form = document.getElementById("config-form") as HTMLFormElement;
const issuerInput = document.getElementById("issuer-input") as HTMLInputElement;
const clientIdInput = document.getElementById("client-id-input") as HTMLInputElement;
const usernameInput = document.getElementById("username-input") as HTMLInputElement;
const statusEl = document.getElementById("config-status") as HTMLDivElement;

form.addEventListener("submit", (event) => {
  event.preventDefault();

  localStorage.setItem(STORAGE_KEYS.issuer, issuerInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.clientId, clientIdInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.username, usernameInput.value.trim());

  statusEl.textContent = "Configuration saved.";
});
