const { Journey } = require("./src/models/journey");
const { Stage } = require("./src/models/stage");
const { UserJourneyService } = require("./src/services/userJourneyService");
const {
  MessageQueueSimulator,
} = require("./src/simulators/messageQueueSimulator");
const { JourneyAPI } = require("./src/api/journeyAPI");
const { config } = require("./config/config");

// Create the journey service
const journeyService = new UserJourneyService();

// Create message queue simulator
const messageQueue = new MessageQueueSimulator(journeyService);

// Create the API
const journeyAPI = new JourneyAPI(journeyService);

// Register the journey service as a consumer of events
const consumerId = messageQueue.registerConsumer((event) => {
  console.log(
    `[Journey Service] Processing event: ${event.event} for user ${event.userId}`
  );
  const results = journeyService.evaluate(event.userId, event);

  if (results.length > 0) {
    console.log(
      `[Journey Service] User ${event.userId} progressed in ${results.length} journeys:`
    );
    results.forEach((result) => {
      console.log(
        `  - Journey ${result.journeyId}: ${result.action} to stage ${result.stageId}`
      );
    });
  } else {
    console.log(`[Journey Service] No journey progressions for this event.`);
  }
});


// Setup scheduled tasks
function setupScheduledTasks() {
  console.log("[Scheduler] Setting up scheduled tasks...");

  // Check time-bound journeys every hour
  setInterval(() => {
    console.log(
      "[Scheduler] Running scheduled check of time-bound journeys..."
    );
    journeyService.checkAndUpdateTimeBasedJourneys();
  }, config.checkIntervalMs);

  console.log("[Scheduler] Scheduled tasks setup complete!");
}

// Setup example journeys 
function setupExampleJourneys() {
  // Create journey J1 (Stage 1 -> Stage 2 -> Stage 3)
  console.log("[Setup] Creating Journey J1...");
  const j1 = new Journey("j1", "First Time User Recharge Journey");

  const j1Stage1 = new Stage(
    "s1_j1",
    "Login",
    (payload) => payload.event === "login",
    true,
    false,
  );

  const j1Stage2 = new Stage(
    "s2_j1",
    "Recharge Page View",
    (payload) =>
      payload.event === "page_view" && payload.details?.page === "recharge",
    false,
    false
  );

  const j1Stage3 = new Stage(
    "s3_j1",
    "Recharge Transaction",
    (payload) =>
      payload.event === "transaction" && payload.details?.type === "recharge",
    false,
    true,
  );

  j1.addStage(j1Stage1).addStage(j1Stage2).addStage(j1Stage3);

  j1.connectStages("s1_j1", "s2_j1");
  j1.connectStages("s2_j1", "s3_j1");

  journeyService.createJourney(j1);

  // Example: Create journey J2 (Stage 1 -> Stage 2)
  console.log("[Setup] Creating Journey J2...");
  const j2 = new Journey("j2", "UPI Lite Account Journey");

  const j2Stage1 = new Stage(
    "s1_j2",
    "UPI Lite Account Opening",
    (payload) =>
      payload.event === "account_open" && payload.details?.type === "upi_lite",
    true,
    false,
  );

  const j2Stage2 = new Stage(
    "s2_j2",
    "UPI Lite Top Up",
    (payload) =>
      payload.event === "transaction" &&
      payload.details?.type === "upi_lite_topup",
    false,
    true
  );

  j2.addStage(j2Stage1).addStage(j2Stage2);

  j2.connectStages("s1_j2", "s2_j2");

  journeyService.createJourney(j2);

  // Create a time-bound journey (promotional offer)
  console.log("[Setup] Creating time-bound promotional journey...");
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7); // 7 days from now

  const promoJourney = new Journey(
    "promo1",
    "One Week Special Promotion",
    true,
    startDate,
    endDate
  );

  const promoStage1 = new Stage(
    "s1_promo",
    "Promo Banner View",
    (payload) =>
      payload.event === "banner_view" &&
      payload.details?.banner === "special_promo",
    true,
    false
  );

  const promoStage2 = new Stage(
    "s2_promo",
    "Promo Page View",
    (payload) =>
      payload.event === "page_view" &&
      payload.details?.page === "special_promo",
    false,
    false,
  );

  const promoStage3 = new Stage(
    "s3_promo",
    "Promo Redemption",
    (payload) => payload.event === "redeem_promo",
    false,
    true
  );

  // Add stages to journey
  promoJourney
    .addStage(promoStage1)
    .addStage(promoStage2)
    .addStage(promoStage3);

  promoJourney.connectStages("s1_promo", "s2_promo");
  promoJourney.connectStages("s2_promo", "s3_promo");

  // Create the journey in the service
  journeyService.createJourney(promoJourney);

 
  // Activate all journeys
  console.log("[Setup] Activating all journeys...");
  journeyService.updateState("j1", true);
  journeyService.updateState("j2", true);
  journeyService.updateState("promo1", true);

  console.log("[Setup] Journey setup completed successfully!");
}

// Simulate user events
function simulateUserEvents() {
  console.log("[Simulator] Starting user event simulation...");

  // User 1 simulation
  setTimeout(() => {
    messageQueue.publishEvent({
      event: "login",
      userId: "user1",
      timestamp: new Date(),
    });
  }, 1000);

  setTimeout(() => {
    messageQueue.publishEvent({
      event: "page_view",
      userId: "user1",
      details: {
        page: "recharge",
      },
      timestamp: new Date(),
    });
  }, 3000);

  // User 2 simulation
  setTimeout(() => {
    messageQueue.publishEvent({
      event: "login",
      userId: "user2",
      timestamp: new Date(),
    });
  }, 1500);

  setTimeout(() => {
    messageQueue.publishEvent({
      event: "page_view",
      userId: "user2",
      details: {
        page: "recharge",
      },
      timestamp: new Date(),
    });
  }, 4000);

  setTimeout(() => {
    messageQueue.publishEvent({
      event: "transaction",
      userId: "user2",
      details: {
        type: "recharge",
        amount: 100,
      },
      timestamp: new Date(),
    });
  }, 6000);

  // User 3 simulation
  setTimeout(() => {
    messageQueue.publishEvent({
      event: "login",
      userId: "user3",
      timestamp: new Date(),
    });
  }, 2000);

  setTimeout(() => {
    messageQueue.publishEvent({
      event: "account_open",
      userId: "user3",
      details: {
        type: "upi_lite",
      },
      timestamp: new Date(),
    });
  }, 5000);

}

function main() {
  console.log("[Main] Starting User Journey Service...");

  setupExampleJourneys();
  setupScheduledTasks();

  // Start the simulation
  simulateUserEvents();

  // Expose API globally for testing
  global.api = journeyAPI;

  console.log("[Main] User Journey Service started successfully!");
  console.log("[Main] API available via global.api object");
}

// Run the application
main();
