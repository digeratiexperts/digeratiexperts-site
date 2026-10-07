import { describe, expect, it } from "vitest";
import { packetPrintModeFor } from "./downloadSolutionPacketPdf";

const UA = {
  android: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipados: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
};

describe("packetPrintModeFor", () => {
  it("downloads on Android, where Chrome cannot print a PDF inside a page", () => {
    expect(packetPrintModeFor(UA.android, 5)).toBe("download");
  });
  it("opens a tab on iPhone, and on iPadOS despite its Macintosh user agent", () => {
    expect(packetPrintModeFor(UA.iphone, 5)).toBe("tab");
    expect(packetPrintModeFor(UA.ipados, 5)).toBe("tab");
  });
  it("prints through the dialog on desktop, including a Mac without touch", () => {
    expect(packetPrintModeFor(UA.windows, 0)).toBe("dialog");
    expect(packetPrintModeFor(UA.ipados, 0)).toBe("dialog");
  });
});
