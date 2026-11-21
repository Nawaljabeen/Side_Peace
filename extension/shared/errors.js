// Typed failures of the ExtensionBridge (REQ-Q02). Names follow docs/api-contract.md: a failed fetch is a
// NetworkError, HTTP 422 (or a request we refuse to send) is a ValidationError, 429/5xx or an unusable
// answer is a ServerError. Nothing here carries a stack trace or server internals to the user.

export class BridgeError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The server could not be reached, or did not answer in time (timedOut is true then). */
export class NetworkError extends BridgeError {
  constructor(message, { timedOut = false, cause } = {}) {
    super(message, { cause });
    this.timedOut = timedOut;
  }
}

/** The request is invalid: refused by us before sending, or rejected by the server with a 422. */
export class ValidationError extends BridgeError {
  constructor(message, { code = "validation_error", cause } = {}) {
    super(message, { cause });
    this.code = code;
  }
}

/** The server answered with a failure (429, 5xx) or with a body we cannot use. */
export class ServerError extends BridgeError {
  constructor(message, { status = null, code = "unknown_error", cause } = {}) {
    super(message, { cause });
    this.status = status;
    this.code = code;
  }
}

const BY_NAME = { NetworkError, ValidationError, ServerError };
const UNKNOWN_MESSAGE = "Something went wrong.";

/** Typed error -> plain object, because chrome.runtime messages can only carry JSON. */
export function toErrorPayload(error) {
  if (error instanceof NetworkError) {
    return { name: error.name, message: error.message, timedOut: error.timedOut };
  }
  if (error instanceof ValidationError) {
    return { name: error.name, message: error.message, code: error.code };
  }
  if (error instanceof ServerError) {
    return { name: error.name, message: error.message, status: error.status, code: error.code };
  }
  // Anything else is a bug on our side: its message may hold paths or values, so it is never shown to the user.
  return { name: "ServerError", message: "Something went wrong. Please try again.", status: 500, code: "internal_error" };
}

/** Plain object -> the matching typed error (an unknown name becomes a ServerError). */
export function fromErrorPayload(payload) {
  const ErrorClass = BY_NAME[payload?.name] ?? ServerError;
  const message = typeof payload?.message === "string" ? payload.message : UNKNOWN_MESSAGE;
  const fields = payload !== null && typeof payload === "object" ? payload : {};
  return new ErrorClass(message, fields);
}
