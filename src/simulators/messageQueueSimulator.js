// This is created only for testing
class MessageQueueSimulator {
  constructor(journeyService) {
    this.journeyService = journeyService;
    this.listeners = [];
  }

  publishEvent(event) {
    console.log(
      `[Message Queue] Publishing event: ${event.event} for user ${event.userId}`
    );
    this.listeners.forEach((listener) => listener(event));
    return true;
  }

  registerConsumer(callback) {
    this.listeners.push(callback);
    return this.listeners.length - 1;
  }
}

module.exports = { MessageQueueSimulator };
