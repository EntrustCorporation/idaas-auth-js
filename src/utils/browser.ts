import type { AuthorizeResponse } from "../models";

const DEFAULT_POPUP_TIMEOUT_SECONDS = 300;

export const openPopup = (popupUrl: string) => {
  const width = 500;
  const height = 700;
  const left = window.screenX + (window.innerWidth - width) / 2;
  const top = window.screenY + (window.innerHeight - height) / 2;

  const popup = window.open(
    popupUrl,
    "idaas:authorize",
    `popup,left=${left},top=${top},width=${width},height=${height}`,
  );

  if (!popup) {
    throw new Error("Unable to open popup, blocked by browser");
  }

  return popup;
};

export const listenToAuthorizePopup = (popup: Window, url: string) => {
  const expectedOrigin = new URL(url).origin;

  return new Promise<AuthorizeResponse>((resolve, reject) => {
    const popupListenerAbortController = new AbortController();

    const popupWebMessageEventHandler = (event: MessageEvent) => {
      const hasOriginAndData = event.origin === expectedOrigin && event.data;
      const isAuthorizeEvent = hasOriginAndData && event.data.type === "authorization_response";

      if (!isAuthorizeEvent) {
        return;
      }

      cleanUpPopup();

      const response = event.data.response;
      if (response.error) {
        reject(new Error(response.error));
      }

      resolve(response as AuthorizeResponse);
    };

    // Poll the popup window every second to see if it's closed. We cannot reliably use eventListeners here to support mobile.
    const pollPopupInterval = setInterval(() => {
      if (popup.closed) {
        cleanUpPopup();
        reject(new Error("Authentication was cancelled by the user"));
      }
    }, 1000);

    // Ensure the popup is closed after a certain timeout period
    const popupTimeout = setTimeout(() => {
      cleanUpPopup();
      reject(new Error("User took too long to authenticate"));
    }, DEFAULT_POPUP_TIMEOUT_SECONDS * 1000);

    const cleanUpPopup = () => {
      clearInterval(pollPopupInterval);
      clearTimeout(popupTimeout);
      popup.close();
      popupListenerAbortController.abort();
    };

    window.addEventListener("message", popupWebMessageEventHandler, {
      signal: popupListenerAbortController.signal,
    });
  });
};

export const browserSupportsPasskey = async (): Promise<boolean> => {
  return !!window.PublicKeyCredential;
};
