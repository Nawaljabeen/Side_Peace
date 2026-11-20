import { MAX_QUERY_LENGTH } from "../shared/constants.js";

export class SidePanelController {
  constructor(bridge, elements) {
    this.bridge = bridge;
    this.input = elements.input;
    this.submitButton = elements.submitButton;
    this.messageArea = elements.messageArea;
    this.answerArea = elements.answerArea;
    this.latestRequestId = 0;
  }

  async handleUserSubmit() {
    const text = this.input.value.trim();
    const requestId = ++this.latestRequestId; // any submit invalidates a reply that is still in flight
    this.answerArea.textContent = "";
    this.submitButton.disabled = false; // nothing is in flight any more; a valid text disables it again below
    if (!text) {
      this.renderError("Please type a question.");
      return;
    }
    if (text.length > MAX_QUERY_LENGTH) {
      this.renderError(`Question is too long (max ${MAX_QUERY_LENGTH} characters).`);
      return;
    }
    this.messageArea.textContent = "";
    this.submitButton.disabled = true;
    try {
      const answer = await this.bridge.sendQuery(text);
      if (requestId === this.latestRequestId) {
        this.renderResponse(answer);
      }
    } catch (error) {
      console.error("Side query failed", error);
      if (requestId === this.latestRequestId) {
        this.renderError("Could not reach the SidePeace server. Please try again.");
      }
    } finally {
      if (requestId === this.latestRequestId) {
        this.submitButton.disabled = false;
      }
    }
  }

  renderResponse(answer) {
    this.answerArea.textContent = answer;
  }

  renderError(message) {
    this.messageArea.textContent = message;
  }
}
