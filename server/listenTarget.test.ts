import { describe, expect, it } from "vitest";
import { describeListenTarget, resolveListenTarget } from "./listenTarget";

const fallback = { port: 3300, host: "127.0.0.1" };

describe("resolveListenTarget", () => {
  it("binds the port itself when systemd passed no socket", () => {
    expect(resolveListenTarget({}, 100, fallback)).toEqual(fallback);
    expect(resolveListenTarget({ LISTEN_FDS: "0", LISTEN_PID: "100" }, 100, fallback)).toEqual(fallback);
  });

  it("takes fd 3 when systemd handed this process a socket", () => {
    expect(resolveListenTarget({ LISTEN_FDS: "1", LISTEN_PID: "100" }, 100, fallback)).toEqual({ fd: 3 });
  });

  it("ignores a LISTEN_PID that is not its own (inherited or stale)", () => {
    expect(resolveListenTarget({ LISTEN_FDS: "1", LISTEN_PID: "99" }, 100, fallback)).toEqual(fallback);
    expect(resolveListenTarget({ LISTEN_FDS: "1" }, 100, fallback)).toEqual(fallback);
  });

  it("ignores garbage", () => {
    expect(resolveListenTarget({ LISTEN_FDS: "many", LISTEN_PID: "100" }, 100, fallback)).toEqual(fallback);
  });

  it("describes both forms for the boot log", () => {
    expect(describeListenTarget({ fd: 3 })).toBe("systemd socket (fd 3)");
    expect(describeListenTarget(fallback)).toBe("http://127.0.0.1:3300");
  });
});
