# User Journey Service

User journey service monitors the user state and onboard it to different journey based on the state.


## File Descriptions

### Models

- **stage.js**: Defines a single stage in a journey with conditions for entry
- **journey.js**: Defines the journey as a directed acyclic graph (DAG) of stages
- **userJourneyState.js**: Tracks a user's current state within a journey

### Services

- **userJourneyService.js**: Core service implementing journey creation, evaluation, and user tracking

### Utilities

- **errorCodes.js**: Constants for error codes used throughout the application

### Simulators

- **messageQueueSimulator.js**: Simulates a message queue for processing user events

### API

- **journeyApi.js**: Provides API endpoints for interacting with the journey service

### Configuration

- **config.js**: Contains application configuration parameters


### Root Files

- **index.js**: Main application entry point. We have added some example to test the code as well.
- **package.json**: Project metadata and dependencies
- **README.md**: Project documentation

## Running the Application

```bash
# Navigate to project root
cd user-journey-service

# Start the application
node index.js

```

## Module Relationships

- The **UserJourneyService** depends on **Stage**, **Journey**, and **UserJourneyState** models
- The **JourneyAPI** provides an interface to the **UserJourneyService**
- The **MessageQueueSimulator** delivers events to the **UserJourneyService**
- The **index.js** coordinates all components and initializes the application