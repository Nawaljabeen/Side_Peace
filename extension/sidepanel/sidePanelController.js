import { MAX_QUERY_LENGTH } from "../shared/constants.js";

export class SidePanelController {
  constructor(bridge, elements) {
    this.bridge = bridge;
    this.input = elements.input;
    this.submitButton = elements.submitButton;
    this.messageArea = elements.messageArea;
    this.answerArea = elements.answerArea;
  }

  async handleUserSubmit() {
    const text = this.input.value.trim();
    if (!text) {
      this.renderError("Please type a question.");
      return;
    }
    if (text.length > MAX_QUERY_LENGTH) {
      this.renderError(`Question is too long (max ${MAX_QUERY_LENGTH} characters).`);
    }
  }

  renderError(message) {
    this.messageArea.textContent = message;
  }
}
