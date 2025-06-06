class Stage {
  constructor(
    id,
    name,
    condition,
    isOnboarding = false,
    isTerminal = false,
    sendSmsOnTransition = false
  ) {
    this.id = id;
    this.name = name;
    this.condition = condition;
    this.isOnboarding = isOnboarding;
    this.isTerminal = isTerminal;
    this.nextStages = [];
    this.sendSmsOnTransition = sendSmsOnTransition;
  }

  addNextStage(stageId) {
    if (!this.isTerminal && !this.nextStages.includes(stageId)) {
      this.nextStages.push(stageId);
      return true;
    }
    return false;
  }

  evaluateCondition(payload) {
    return this.condition(payload);
  }
}

module.exports = { Stage };
