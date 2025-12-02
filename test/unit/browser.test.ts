import { beforeEach, describe, expect, it, mock } from "bun:test";
import { browserSupportsPasskey, openPopup } from "../../src/utils/browser";

describe("browser.ts", () => {
  describe("openPopup", () => {
    let windowOpenMock: ReturnType<typeof mock>;
    let originalWindowOpen: typeof window.open;

    beforeEach(() => {
      originalWindowOpen = window.open;
      windowOpenMock = mock(() => ({
        closed: false,
        close: mock(() => {}),
      }));
      window.open = windowOpenMock as unknown as typeof window.open;
    });

    it("should open popup with correct dimensions", () => {
      const url = "https://example.com/authorize";

      try {
        openPopup(url);
      } catch {
        // May fail in test environment
      }

      expect(windowOpenMock).toHaveBeenCalledTimes(1);
      const [calledUrl, name, features] = windowOpenMock.mock.calls[0] ?? [];

      expect(calledUrl).toBe(url);
      expect(name).toBe("idaas:authorize");
      expect(features).toContain("width=500");
      expect(features).toContain("height=700");
      expect(features).toContain("popup");
    });

    it("should calculate centered position", () => {
      Object.defineProperty(window, "screenX", { value: 100, configurable: true });
      Object.defineProperty(window, "screenY", { value: 200, configurable: true });
      Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });

      try {
        openPopup("https://example.com");
      } catch {
        // May fail in test environment
      }

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

      // Restore
      window.open = originalWindowOpen;
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
});
