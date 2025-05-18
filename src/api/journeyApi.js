const { Journey } = require("../models/journey");
const { Stage } = require("../models/stage");

class JourneyAPI {
  constructor(journeyService) {
    this.journeyService = journeyService;
  }

  getAllJourneys() {
    return Array.from(this.journeyService.journeys.values()).map((journey) => ({
      id: journey.id,
      name: journey.name,
      isActive: journey.isActive,
      isTimeBound: journey.isTimeBound,
      startDate: journey.startDate,
      endDate: journey.endDate,
    }));
  }

  getJourney(journeyId) {
    try {
      return this.journeyService.getJourney(journeyId);
    } catch (error) {
      return { error: error.errorCode, message: error.message };
    }
  }

  createJourney(journeyData) {
    try {
      const journey = new Journey(
        journeyData.id,
        journeyData.name,
        journeyData.isTimeBound,
        journeyData.startDate,
        journeyData.endDate
      );

      // Add stages and connections
      journeyData.stages.forEach((stageData) => {
        const stage = new Stage(
          stageData.id,
          stageData.name,
          eval(stageData.conditionFn), // Note: In a real system, this would be handled more securely
          stageData.isOnboarding,
          stageData.isTerminal
        );

        journey.addStage(stage);
      });

      journeyData.connections.forEach((conn) => {
        journey.connectStages(conn.sourceId, conn.targetId);
      });

      return this.journeyService.createJourney(journey);
    } catch (error) {
      return {
        error: error.errorCode || "UNKNOWN_ERROR",
        message: error.message,
      };
    }
  }

  updateJourneyState(journeyId, active) {
    try {
      return this.journeyService.updateState(journeyId, active);
    } catch (error) {
      return { error: error.errorCode, message: error.message };
    }
  }

  getUserCurrentStage(userId, journeyId) {
    try {
      const stage = this.journeyService.getCurrentStage(userId, journeyId);
      return {
        userId,
        journeyId,
        stageId: stage.id,
        stageName: stage.name,
      };
    } catch (error) {
      return { error: error.errorCode, message: error.message };
    }
  }

  isUserOnboarded(userId, journeyId) {
    try {
      return {
        userId,
        journeyId,
        isOnboarded: this.journeyService.isOnboarded(userId, journeyId),
      };
    } catch (error) {
      return { error: error.errorCode, message: error.message };
    }
  }

  getUserJourneys(userId) {
    try {
      return this.journeyService.getUserJourneys(userId);
    } catch (error) {
      return {
        error: error.errorCode || "UNKNOWN_ERROR",
        message: error.message,
      };
    }
  }

  evaluateUserEvent(userId, payload) {
    try {
      return this.journeyService.evaluate(userId, payload);
    } catch (error) {
      return {
        error: error.errorCode || "UNKNOWN_ERROR",
        message: error.message,
      };
    }
  }
}

module.exports = { JourneyAPI };
