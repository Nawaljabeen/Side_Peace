// REQ-Q02: every failure of the ExtensionBridge leaves as one of three typed errors, so the side panel can
// choose a message with instanceof and never has to look at a stack trace or a server detail.
import { describe, it, expect } from "vitest";
import { BridgeError, NetworkError, ServerError, ValidationError } from "../shared/errors.js";

describe("bridge error classes", () => {
  it.each([
    ["NetworkError", NetworkError],
    ["ServerError", ServerError],
    ["ValidationError", ValidationError],
  ])("%s is an Error and a BridgeError with its own name and message", (name, ErrorClass) => {
    const error = new ErrorClass("something went wrong");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BridgeError);
    expect(error.name).toBe(name);
    expect(error.message).toBe("something went wrong");
  });

  it("lets a caller tell the three kinds apart with instanceof", () => {
    expect(new NetworkError("n")).not.toBeInstanceOf(ServerError);
    expect(new ServerError("s")).not.toBeInstanceOf(ValidationError);
    expect(new ValidationError("v")).not.toBeInstanceOf(NetworkError);
  });

  it("NetworkError keeps the original failure as its cause and says whether it was a timeout", () => {
    const cause = new TypeError("Failed to fetch");

    expect(new NetworkError("down", { cause }).cause).toBe(cause);
    expect(new NetworkError("down").timedOut).toBe(false);
    expect(new NetworkError("slow", { timedOut: true }).timedOut).toBe(true);
  });

  it("ServerError carries the HTTP status and the machine code from the contract", () => {
    const error = new ServerError("The AI service took too long.", { status: 504, code: "provider_timeout" });

    expect(error.status).toBe(504);
    expect(error.code).toBe("provider_timeout");
  });

  it("ServerError falls back to unknown values when none are given", () => {
    const error = new ServerError("bad");

    expect(error.status).toBeNull();
    expect(error.code).toBe("unknown_error");
  });

  it("ValidationError carries the machine code, 'validation_error' by default", () => {
    expect(new ValidationError("bad text").code).toBe("validation_error");
    expect(new ValidationError("bad text", { code: "too_long" }).code).toBe("too_long");
  });
});
