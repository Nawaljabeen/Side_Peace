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
    }
  }

  renderError(message) {
    this.messageArea.textContent = message;
  }
}
