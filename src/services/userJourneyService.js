const { ErrorCodes } = require("../utils/errorCodes");
const { UserJourneyState } = require("../models/userjourneyState");
const { SmsService } = require("./SmsService");

class UserJourneyService {
  constructor() {
    this.journeys = new Map(); // Map of journey ID to Journey object
    this.userJourneyStates = new Map(); // Map of userId-journeyId to UserJourneyState
    this.smsService = new SmsService();
  }

  // Create a new journey
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

  // Update journey active state
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

  // Get journey details
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

  // Get the user-journey state key
  getUserJourneyStateKey(userId, journeyId) {
    return `${userId}-${journeyId}`;
  }

  // Check if user is onboarded to a journey
  isOnboarded(userId, journeyId) {
    const stateKey = this.getUserJourneyStateKey(userId, journeyId);
    return this.userJourneyStates.has(stateKey);
  }

  // Get current stage of user in a journey
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

  // Onboard user to a journey
  onboardUserToJourney(userId, journey, timestamp = new Date()) {
    const stateKey = this.getUserJourneyStateKey(userId, journey.id);

    // Check if user is already onboarded to this journey
    if (this.userJourneyStates.has(stateKey) && !journey.isRecurring) {
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

    // Send SMS if configured for onboarding stage
    if (onboardingStage.sendSmsOnTransition) {
      this.smsService.sendSms(
        userId,
        `Welcome to journey ${journey.name}! You have entered the ${onboardingStage.name} stage.`
      );
    }

    return userState;
  }

  // Move user to next stage in a journey
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

    // Check if the next stage is valid
    if (!currentStage.nextStages.includes(nextStage.id)) {
      throw {
        errorCode: ErrorCodes.INVALID_STAGE,
        message: `Stage ${nextStage.id} is not a valid next stage from ${currentStage.id}`,
      };
    }

    userState.moveToStage(nextStage.id, timestamp);

    // Send SMS if configured for this stage
    if (nextStage.sendSmsOnTransition) {
      this.smsService.sendSms(
        userId,
        `You have moved to the ${nextStage.name} stage in journey ${journey.name}!`
      );
    }

    return userState;
  }

  // Evaluate a payload for user journey progression
  evaluate(userId, payload) {
    const timestamp = new Date();
    const results = [];

    // Check all journeys for potential onboarding
    this.journeys.forEach((journey) => {
      // Skip inactive journeys
      if (!journey.isValidAtTime(timestamp)) {
        return;
      }

      const onboardingStage = journey.getOnboardingStage();
      const stateKey = this.getUserJourneyStateKey(userId, journey.id);
      const userState = this.userJourneyStates.get(stateKey);

      // Check for onboarding if user is not already onboarded or if it's a recurring journey
      if (!userState || journey.isRecurring) {
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
            // Skip if already onboarded to non-recurring journey
            if (error.errorCode !== ErrorCodes.USER_ALREADY_ONBOARDED) {
              throw error;
            }
          }
        }
      }

      // Check for progression if already onboarded
      if (userState) {
        const currentStage = journey.getStage(userState.currentStageId);

        // Skip if already at terminal stage
        if (currentStage.isTerminal) {
          return;
        }

        // Check all possible next stages
        for (const nextStageId of currentStage.nextStages) {
          const nextStage = journey.getStage(nextStageId);

          if (nextStage.evaluateCondition(payload)) {
            this.moveUserToNextStage(userId, journey, nextStage, timestamp);
            results.push({
              journeyId: journey.id,
              action: "MOVED",
              stageId: nextStageId,
            });

            // Only move to one next stage per evaluation
            break;
          }
        }
      }
    });

    return results;
  }

  // Get all users in a journey
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

  // Get all journeys a user is part of
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

  // Check and update all time-bound journeys
  checkAndUpdateTimeBasedJourneys() {
    const now = new Date();

    this.journeys.forEach((journey) => {
      if (journey.isTimeBound && journey.isActive) {
        // Deactivate if end date has passed
        if (journey.endDate && now > journey.endDate) {
          journey.isActive = false;
          console.log(
            `Journey ${journey.id} automatically marked inactive due to end date passing`
          );
        }

        // Activate if start date has arrived
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
