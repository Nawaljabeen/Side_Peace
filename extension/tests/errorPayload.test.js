// REQ-Q02: a chrome.runtime message can only carry plain JSON, so a typed error must be turned into a plain
// object on the service-worker side and back into the same typed error on the side-panel side.
import { describe, it, expect } from "vitest";
import { NetworkError, ServerError, ValidationError, fromErrorPayload, toErrorPayload } from "../shared/errors.js";

const roundTrip = (error) => fromErrorPayload(JSON.parse(JSON.stringify(toErrorPayload(error))));

describe("toErrorPayload", () => {
  it("turns each typed error into a plain object that survives JSON", () => {
    expect(toErrorPayload(new NetworkError("down", { timedOut: true }))).toEqual({
      name: "NetworkError",
      message: "down",
      timedOut: true,
    });
    expect(toErrorPayload(new ServerError("busy", { status: 503, code: "provider_rate_limit" }))).toEqual({
      name: "ServerError",
      message: "busy",
      status: 503,
      code: "provider_rate_limit",
    });
    expect(toErrorPayload(new ValidationError("bad text", { code: "too_long" }))).toEqual({
      name: "ValidationError",
      message: "bad text",
      code: "too_long",
    });
  });

  it("never passes the message or stack of an unexpected error to the user interface", () => {
    const payload = toErrorPayload(new TypeError("Cannot read C:\\secret\\path"));

    expect(payload.name).toBe("ServerError");
    expect(payload.code).toBe("internal_error");
    expect(JSON.stringify(payload)).not.toContain("secret");
    expect(payload).not.toHaveProperty("stack");
  });

  it.each([["a string", "boom"], ["null", null], ["undefined", undefined], ["a number", 5]])(
    "copes with something that is not an Error: %s",
    (_label, thrown) => {
      expect(toErrorPayload(thrown).code).toBe("internal_error");
    },
  );
});

describe("fromErrorPayload", () => {
  it("rebuilds the same kind of error with its fields", () => {
    const network = roundTrip(new NetworkError("slow", { timedOut: true }));
    const server = roundTrip(new ServerError("busy", { status: 504, code: "provider_timeout" }));
    const validation = roundTrip(new ValidationError("bad", { code: "too_long" }));

    expect(network).toBeInstanceOf(NetworkError);
    expect(network.timedOut).toBe(true);
    expect(server).toBeInstanceOf(ServerError);
    expect([server.status, server.code]).toEqual([504, "provider_timeout"]);
    expect(validation).toBeInstanceOf(ValidationError);
    expect(validation.code).toBe("too_long");
    expect(validation.message).toBe("bad");
  });

  it.each([
    ["an unknown name", { name: "WeirdError", message: "hmm" }],
    ["no payload at all", undefined],
    ["null", null],
    ["a string", "oops"],
  ])("falls back to a ServerError for %s", (_label, payload) => {
    expect(fromErrorPayload(payload)).toBeInstanceOf(ServerError);
  });

  it("uses a safe message when the payload has none", () => {
    expect(fromErrorPayload({ name: "NetworkError" }).message).toBe("Something went wrong.");
    expect(fromErrorPayload({ name: "NetworkError", message: 42 }).message).toBe("Something went wrong.");
  });
});
