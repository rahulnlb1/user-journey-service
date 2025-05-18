class Journey {
  constructor(id, name, isTimeBound = false, startDate = null, endDate = null) {
    this.id = id;
    this.name = name;
    this.stages = new Map();
    this.isTimeBound = isTimeBound;
    this.startDate = startDate;
    this.endDate = endDate;
    this.isActive = false;
    this.onboardingStageId = null;
    this.terminalStageId = null;
  }

  addStage(stage) {
    if (this.stages.has(stage.id)) {
      throw new Error(
        `Stage with ID ${stage.id} already exists in this journey`
      );
    }

    this.stages.set(stage.id, stage);

    if (stage.isOnboarding) {
      if (this.onboardingStageId !== null) {
        throw new Error("Journey can only have one onboarding stage");
      }
      this.onboardingStageId = stage.id;
    }

    if (stage.isTerminal) {
      if (this.terminalStageId !== null) {
        throw new Error("Journey can only have one terminal stage");
      }
      this.terminalStageId = stage.id;
    }

    return this;
  }

  connectStages(sourceStageId, targetStageId) {
    if (!this.stages.has(sourceStageId) || !this.stages.has(targetStageId)) {
      throw new Error("Source or target stage does not exist");
    }

    const sourceStage = this.stages.get(sourceStageId);
    return sourceStage.addNextStage(targetStageId);
  }

  validate() {
    if (this.onboardingStageId === null) {
      throw new Error("Journey must have an onboarding stage");
    }

    if (this.terminalStageId === null) {
      throw new Error("Journey must have a terminal stage");
    }

    const visited = new Set();
    const toVisit = [this.onboardingStageId];

    while (toVisit.length > 0) {
      const currentStageId = toVisit.shift();

      if (currentStageId === this.terminalStageId) {
        // This means that we have a path till terminal stage
        return true;
      }

      if (visited.has(currentStageId)) {
        continue;
      }

      visited.add(currentStageId);
      const currentStage = this.stages.get(currentStageId);

      for (const nextStageId of currentStage.nextStages) {
        toVisit.push(nextStageId);
      }
    }

    throw new Error("No valid path from onboarding to terminal stage");
  }

  // Check if the journey is valid at the current time
  isValidAtTime(currentTime = new Date()) {
    if (!this.isActive) {
      return false;
    }

    if (!this.isTimeBound) {
      return true; // Perpetual journey
    }

    return (
      (!this.startDate || currentTime >= this.startDate) &&
      (!this.endDate || currentTime <= this.endDate)
    );
  }

  getOnboardingStage() {
    return this.stages.get(this.onboardingStageId);
  }

  getStage(stageId) {
    return this.stages.get(stageId);
  }

  getNextStages(stageId) {
    const stage = this.stages.get(stageId);
    if (!stage) {
      return [];
    }
    return stage.nextStages.map((id) => this.stages.get(id));
  }
}

module.exports = { Journey };
