// REQ-Q02: every failure the extension reports to the user has a type (docs/api-contract.md, "Errors").
import { describe, it, expect } from "vitest";
import { NetworkError, ValidationError, ServerError, toErrorPayload, fromErrorPayload } from "../shared/errors.js";

describe("typed errors", () => {
  it.each([
    [NetworkError, "NetworkError"],
    [ValidationError, "ValidationError"],
    [ServerError, "ServerError"],
  ])("%s is an Error with its own name", (ErrorClass, name) => {
    const error = new ErrorClass("something failed");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(name);
    expect(error.message).toBe("something failed");
  });

  it("ServerError keeps the HTTP status and the machine code from the backend", () => {
    const error = new ServerError("busy", { status: 429, code: "provider_rate_limit" });
    expect(error.status).toBe(429);
    expect(error.code).toBe("provider_rate_limit");
  });

  it("NetworkError can say that the request timed out", () => {
    expect(new NetworkError("too slow", { timedOut: true }).timedOut).toBe(true);
    expect(new NetworkError("offline").timedOut).toBe(false);
  });

  it("survives a trip through chrome.runtime messaging (plain objects only)", () => {
    const payload = toErrorPayload(new ServerError("busy", { status: 429, code: "provider_rate_limit" }));
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);

    const restored = fromErrorPayload(payload);
    expect(restored).toBeInstanceOf(ServerError);
    expect(restored.status).toBe(429);
    expect(restored.message).toBe("busy");
  });

  it("turns an unknown error into a ServerError payload without leaking its details", () => {
    const payload = toErrorPayload(new TypeError("secret detail"));
    expect(payload.name).toBe("ServerError");
    expect(payload.message).not.toMatch(/secret/);
  });
});
