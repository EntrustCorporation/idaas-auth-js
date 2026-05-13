import { afterEach, beforeEach, describe, expect, it, jest, mock } from "bun:test";
import { browserSupportsPasskey, listenToAuthorizePopup, openPopup } from "../../src/utils/browser";

describe("browser.ts", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe("openPopup", () => {
    let windowOpenMock: ReturnType<typeof mock>;
    let originalWindowOpen: typeof window.open;
    const screenXDescriptor = Object.getOwnPropertyDescriptor(window, "screenX");
    const screenYDescriptor = Object.getOwnPropertyDescriptor(window, "screenY");
    const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");
    const innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight");

    beforeEach(() => {
      originalWindowOpen = window.open;
      windowOpenMock = mock(() => ({
        closed: false,
        close: mock(() => {}),
      }));
      window.open = windowOpenMock as unknown as typeof window.open;
    });

    afterEach(() => {
      window.open = originalWindowOpen;
      if (screenXDescriptor) {
        Object.defineProperty(window, "screenX", screenXDescriptor);
      }
      if (screenYDescriptor) {
        Object.defineProperty(window, "screenY", screenYDescriptor);
      }
      if (innerWidthDescriptor) {
        Object.defineProperty(window, "innerWidth", innerWidthDescriptor);
      }
      if (innerHeightDescriptor) {
        Object.defineProperty(window, "innerHeight", innerHeightDescriptor);
      }
    });

    it("should open popup with correct dimensions", () => {
      const url = "https://example.com/authorize";

      const popup = openPopup(url);

      expect(windowOpenMock).toHaveBeenCalledTimes(1);
      const [calledUrl, name, features] = windowOpenMock.mock.calls[0] ?? [];

      expect(calledUrl).toBe(url);
      expect(name).toBe("idaas:authorize");
      expect(features).toContain("width=500");
      expect(features).toContain("height=700");
      expect(features).toContain("popup");
      expect(popup).toBeDefined();
    });

    it("should calculate centered position", () => {
      Object.defineProperty(window, "screenX", { value: 100, configurable: true });
      Object.defineProperty(window, "screenY", { value: 200, configurable: true });
      Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });

      openPopup("https://example.com");

      const features = windowOpenMock.mock.calls[0]?.[2] as string;
      // left = 100 + (1200 - 500) / 2 = 450
      // top = 200 + (900 - 700) / 2 = 300
      expect(features).toContain("left=450");
      expect(features).toContain("top=300");

      // Restore defaults
      Object.defineProperty(window, "screenX", { value: 0, configurable: true });
      Object.defineProperty(window, "screenY", { value: 0, configurable: true });
      Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
    });

    it("should throw error when popup is blocked", () => {
      windowOpenMock = mock(() => null);
      window.open = windowOpenMock as unknown as typeof window.open;

      expect(() => openPopup("https://example.com")).toThrow("Unable to open popup, blocked by browser");
    });
  });

  describe("browserSupportsPasskey", () => {
    it("should check for PublicKeyCredential existence", async () => {
      // In HappyDOM test environment, PublicKeyCredential may not be available
      const result = await browserSupportsPasskey();
      expect(typeof result).toBe("boolean");
      // The function returns !!window.PublicKeyCredential
      expect(result).toBe(!!window.PublicKeyCredential);
    });

    it("should return boolean value", async () => {
      const result = await browserSupportsPasskey();
      expect([true, false]).toContain(result);
    });
  });

  describe("listenToAuthorizePopup", () => {
    it("resolves when authorization response is received", async () => {
      const popup = {
        closed: false,
        close: mock(() => {}),
      } as unknown as Window;

      const promise = listenToAuthorizePopup(popup, "https://example.com/authorize");

      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://example.com",
          data: {
            type: "authorization_response",
            response: {
              code: "auth-code",
              state: "state",
              error: null,
              error_description: null,
            },
          },
        }),
      );

      const response = await promise;

      expect(response.code).toBe("auth-code");
      expect(popup.close).toHaveBeenCalledTimes(1);
    });

    it("rejects when authorization response includes error", async () => {
      const popup = {
        closed: false,
        close: mock(() => {}),
      } as unknown as Window;

      const promise = listenToAuthorizePopup(popup, "https://example.com/authorize");

      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://example.com",
          data: {
            type: "authorization_response",
            response: {
              error: "access_denied",
            },
          },
        }),
      );

      await expect(promise).rejects.toThrow("access_denied");
      expect(popup.close).toHaveBeenCalledTimes(1);
    });

    it("ignores non-authorization messages", async () => {
      jest.useFakeTimers();
      const popup = {
        closed: false,
        close: mock(() => {}),
      } as unknown as Window;

      const promise = listenToAuthorizePopup(popup, "https://example.com/authorize");

      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://other.example.com",
          data: {
            type: "status_update",
          },
        }),
      );

      Object.defineProperty(popup, "closed", { value: true, configurable: true });
      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow("Authentication was cancelled by the user");
      jest.useRealTimers();
    });

    it("rejects when popup is closed by the user", async () => {
      jest.useFakeTimers();
      const popup = {
        closed: false,
        close: mock(() => {}),
      } as unknown as Window;

      const promise = listenToAuthorizePopup(popup, "https://example.com/authorize");

      Object.defineProperty(popup, "closed", { value: true, configurable: true });
      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow("Authentication was cancelled by the user");
      jest.useRealTimers();
    });

    it("rejects when popup times out", async () => {
      jest.useFakeTimers();
      const popup = {
        closed: false,
        close: mock(() => {}),
      } as unknown as Window;

      const promise = listenToAuthorizePopup(popup, "https://example.com/authorize");

      jest.advanceTimersByTime(300000);

      await expect(promise).rejects.toThrow("User took too long to authenticate");
      jest.useRealTimers();
    });
  });
});
