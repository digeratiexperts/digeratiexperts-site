import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  fetchHubContractDownload,
  TECHSALES_CONTRACT_DOWNLOAD_MAX_BYTES,
  TECHSALES_CONTRACT_DOWNLOAD_TIMEOUT_MS,
} from "./techSalesClient";

describe("TechSales contract download transport limits", () => {
  const originalEnvironment = new Map<string, string | undefined>();
  const environmentKeys = [
    "TECHSALES_HUB_URL",
    "PORTAL_TO_HUB_SECRET",
    "TECHSALES_SYNC_TOKEN",
  ];

  beforeAll(() => {
    for (const key of environmentKeys) {
      originalEnvironment.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.TECHSALES_HUB_URL = "https://hub.example.test";
    process.env.PORTAL_TO_HUB_SECRET = "contract-download-test-secret";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    for (const key of environmentKeys) {
      const value = originalEnvironment.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("preserves the successful download contract while attaching an abort signal", async () => {
    const pdf = Buffer.from("%PDF-1.7\ncontract");
    const fetchMock = vi.fn().mockResolvedValue(new Response(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="signed-agreement.pdf"',
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHubContractDownload(
      123,
      "Contract Download Company",
      "signed_pdf",
      "hub-account-42",
    );

    expect(result).toMatchObject({
      contentType: "application/pdf",
      fileName: "signed-agreement.pdf",
    });
    expect(result?.buffer).toEqual(pdf);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.signal?.aborted).toBe(false);
  });

  it("aborts a download that exceeds the request deadline", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null = null;
    const fetchMock = vi.fn((_url: string, request?: RequestInit) => {
      requestSignal = request?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        }, { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchHubContractDownload(123, "Contract Download Company");
    await vi.advanceTimersByTimeAsync(TECHSALES_CONTRACT_DOWNLOAD_TIMEOUT_MS);

    await expect(pending).resolves.toBeNull();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("rejects an oversized declared response before buffering its body", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: {
        "content-length": String(TECHSALES_CONTRACT_DOWNLOAD_MAX_BYTES + 1),
        "content-type": "application/pdf",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchHubContractDownload(123, "Contract Download Company")).resolves.toBeNull();
    expect(cancelled).toBe(true);
  });

  it("cancels a chunked response when streamed bytes cross the ceiling", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    chunk.set(Buffer.from("%PDF-1.7\n"));
    let cancelled = false;
    let chunksSent = 0;
    const availableChunks = Math.ceil(TECHSALES_CONTRACT_DOWNLOAD_MAX_BYTES / chunk.byteLength) + 2;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunksSent >= availableChunks) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
        chunksSent += 1;
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchHubContractDownload(123, "Contract Download Company")).resolves.toBeNull();
    expect(cancelled).toBe(true);
  });
});
