// Typed errors (REQ-Q02). The names follow docs/api-contract.md: a failed fetch is a NetworkError,
// HTTP 422 is a ValidationError, 429/500/502/504 (or an unusable answer) is a ServerError.

export class NetworkError extends Error {
  constructor(message, { timedOut = false } = {}) {
    super(message);
    this.name = "NetworkError";
    this.timedOut = timedOut;
  }
}

export class ValidationError extends Error {
  constructor(message, { status = 422, code = "validation_error" } = {}) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
    this.code = code;
  }
}

export class ServerError extends Error {
  constructor(message, { status = 500, code = "internal_error" } = {}) {
    super(message);
    this.name = "ServerError";
    this.status = status;
    this.code = code;
  }
}

const BY_NAME = { NetworkError, ValidationError, ServerError };

/** Error -> plain object, because chrome.runtime messages can only carry JSON. */
export function toErrorPayload(error) {
  if (error instanceof NetworkError) {
    return { name: error.name, message: error.message, timedOut: error.timedOut };
  }
  if (error instanceof ValidationError || error instanceof ServerError) {
    return { name: error.name, message: error.message, status: error.status, code: error.code };
  }
  // Anything else is a bug on our side: never pass its message (it may contain paths or values) to the UI.
  return { name: "ServerError", message: "Something went wrong. Please try again.", status: 500, code: "internal_error" };
}

/** Plain object -> the matching typed error (unknown names become a ServerError). */
export function fromErrorPayload(payload) {
  const ErrorClass = BY_NAME[payload?.name] ?? ServerError;
  const message = typeof payload?.message === "string" ? payload.message : "Something went wrong.";
  return new ErrorClass(message, payload ?? {});
}
