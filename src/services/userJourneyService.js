const { ErrorCodes } = require("../utils/errorCodes");
const { UserJourneyState } = require("../models/userjourneyState");

class UserJourneyService {
  constructor() {
    this.journeys = new Map();
    this.userJourneyStates = new Map();
  }

  createJourney(journey) {
    if (this.journeys.has(journey.id)) {
      throw {
        errorCode: ErrorCodes.JOURNEY_ALREADY_EXISTS,
        message: `Journey with ID ${journey.id} already exists`,
      };
    }

    try {
      journey.validate();
    } catch (error) {
      throw {
        errorCode: ErrorCodes.INVALID_JOURNEY,
        message: error.message,
      };
    }

    this.journeys.set(journey.id, journey);
    return journey;
  }

  updateState(journeyId, active) {
    const journey = this.journeys.get(journeyId);
    if (!journey) {
      throw {
        errorCode: ErrorCodes.JOURNEY_NOT_FOUND,
        message: `Journey with ID ${journeyId} not found`,
      };
    }

    journey.isActive = active;

    // If journey is time-bound and now inactive, check if it's due to time expiry
    if (
      !active &&
      journey.isTimeBound &&
      journey.endDate &&
      new Date() > journey.endDate
    ) {
      console.log(
        `Journey ${journeyId} automatically marked inactive due to end date passing`
      );
    }

    return true;
  }

  getJourney(journeyId) {
    const journey = this.journeys.get(journeyId);
    if (!journey) {
      throw {
        errorCode: ErrorCodes.JOURNEY_NOT_FOUND,
        message: `Journey with ID ${journeyId} not found`,
      };
    }
    return journey;
  }

  getUserJourneyStateKey(userId, journeyId) {
    return `${userId}-${journeyId}`;
  }

  isOnboarded(userId, journeyId) {
    const stateKey = this.getUserJourneyStateKey(userId, journeyId);
    return this.userJourneyStates.has(stateKey);
  }

  getCurrentStage(userId, journeyId) {
    const stateKey = this.getUserJourneyStateKey(userId, journeyId);
    const userState = this.userJourneyStates.get(stateKey);

    if (!userState) {
      throw {
        errorCode: ErrorCodes.USER_NOT_ONBOARDED,
        message: `User ${userId} is not onboarded to journey ${journeyId}`,
      };
    }

    const journey = this.getJourney(journeyId);
    return journey.getStage(userState.currentStageId);
  }

  onboardUserToJourney(userId, journey, timestamp = new Date()) {
    const stateKey = this.getUserJourneyStateKey(userId, journey.id);

    if (this.userJourneyStates.has(stateKey)) {
      throw {
        errorCode: ErrorCodes.USER_ALREADY_ONBOARDED,
        message: `User ${userId} is already onboarded to journey ${journey.id}`,
      };
    }

    const onboardingStage = journey.getOnboardingStage();
    const userState = new UserJourneyState(
      userId,
      journey.id,
      onboardingStage.id,
      timestamp
    );

    this.userJourneyStates.set(stateKey, userState);

    return userState;
  }

  moveUserToNextStage(userId, journey, nextStage, timestamp = new Date()) {
    const stateKey = this.getUserJourneyStateKey(userId, journey.id);
    const userState = this.userJourneyStates.get(stateKey);

    if (!userState) {
      throw {
        errorCode: ErrorCodes.USER_NOT_ONBOARDED,
        message: `User ${userId} is not onboarded to journey ${journey.id}`,
      };
    }

    const currentStage = journey.getStage(userState.currentStageId);

    if (!currentStage.nextStages.includes(nextStage.id)) {
      throw {
        errorCode: ErrorCodes.INVALID_STAGE,
        message: `Stage ${nextStage.id} is not a valid next stage from ${currentStage.id}`,
      };
    }

    userState.moveToStage(nextStage.id, timestamp);

    return userState;
  }

  evaluate(userId, payload) {
    const timestamp = new Date();
    const results = [];

    this.journeys.forEach((journey) => {
      if (!journey.isValidAtTime(timestamp)) {
        return;
      }

      const onboardingStage = journey.getOnboardingStage();
      const stateKey = this.getUserJourneyStateKey(userId, journey.id);
      const userState = this.userJourneyStates.get(stateKey);

      if (!userState) {
        if (onboardingStage.evaluateCondition(payload)) {
          try {
            const newState = this.onboardUserToJourney(
              userId,
              journey,
              timestamp
            );
            results.push({
              journeyId: journey.id,
              action: "ONBOARDED",
              stageId: onboardingStage.id,
            });
          } catch (error) {
            // Skip if already onboarded
            if (error.errorCode !== ErrorCodes.USER_ALREADY_ONBOARDED) {
              throw error;
            }
          }
        }
      }

      if (userState) {
        const currentStage = journey.getStage(userState.currentStageId);

        if (currentStage.isTerminal) {
          return;
        }

        for (const nextStageId of currentStage.nextStages) {
          const nextStage = journey.getStage(nextStageId);

          if (nextStage.evaluateCondition(payload)) {
            this.moveUserToNextStage(userId, journey, nextStage, timestamp);
            results.push({
              journeyId: journey.id,
              action: "MOVED",
              stageId: nextStageId,
            });

            break;
          }
        }
      }
    });

    return results;
  }

  getUsersInJourney(journeyId) {
    const journey = this.getJourney(journeyId);
    const users = [];

    this.userJourneyStates.forEach((state, key) => {
      if (state.journeyId === journeyId) {
        users.push({
          userId: state.userId,
          currentStageId: state.currentStageId,
          onboardedAt: state.onboardedAt,
        });
      }
    });

    return users;
  }

  getUserJourneys(userId) {
    const journeys = [];

    this.userJourneyStates.forEach((state, key) => {
      if (state.userId === userId) {
        const journey = this.getJourney(state.journeyId);
        journeys.push({
          journeyId: journey.id,
          journeyName: journey.name,
          currentStageId: state.currentStageId,
          onboardedAt: state.onboardedAt,
        });
      }
    });

    return journeys;
  }

  checkAndUpdateTimeBasedJourneys() {
    const now = new Date();

    this.journeys.forEach((journey) => {
      if (journey.isTimeBound && journey.isActive) {
        if (journey.endDate && now > journey.endDate) {
          journey.isActive = false;
          console.log(
            `Journey ${journey.id} automatically marked inactive due to end date passing`
          );
        }

        if (
          journey.startDate &&
          now >= journey.startDate &&
          !journey.isActive
        ) {
          journey.isActive = true;
          console.log(
            `Journey ${journey.id} automatically marked active due to start date arriving`
          );
        }
      }
    });
  }
}

module.exports = { UserJourneyService };
