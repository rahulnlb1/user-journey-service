class UserJourneyState {
  constructor(userId, journeyId, currentStageId, onboardedAt) {
    this.userId = userId;
    this.journeyId = journeyId;
    this.currentStageId = currentStageId;
    this.onboardedAt = onboardedAt;
    this.completedStageIds = new Set();
    this.history = [
      {
        stageId: currentStageId,
        timestamp: onboardedAt,
        action: "ONBOARDED",
      },
    ];
  }

  moveToStage(stageId, timestamp = new Date()) {
    this.completedStageIds.add(this.currentStageId);
    this.currentStageId = stageId;
    this.history.push({
      stageId,
      timestamp,
      action: "MOVED",
    });
  }

  hasCompletedStage(stageId) {
    return this.completedStageIds.has(stageId);
  }
}

module.exports = { UserJourneyState };
