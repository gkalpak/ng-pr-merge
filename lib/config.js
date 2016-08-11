'use strict';

// Classes
class Config {
  // Constructor
  constructor(pkg) {
    let defRepo = 'angular/angular.js';
    let defBranch = 'master';
    let cleanUpMessage = '(Clean-up might be needed.)';
    let usageMessage = `  USAGE: ${pkg.name} <PRNO> [--branch=<BRANCH>] [--repo=<REPO>]\n` +
                       `         (Defaults: BRANCH="${defBranch}", REPO="${defRepo}")`;

    this.defaults = {
      repo: defRepo,
      branch: defBranch
    };

    this.errorMessages = {
      ERROR_missingPrNo: `No PR specified\n\n${usageMessage}`,
      ERROR_phase1: 'Failed to verify the CLA signature.',
      ERROR_phase2: `Failed to fetch the PR as a local branch. ${cleanUpMessage}`,
      ERROR_phase3: `Failed to properly merge the PR into master. ${cleanUpMessage}`,
      ERROR_phase5: `Failed to run the CI-checks or the CI-checks didn\'t pass. ${cleanUpMessage}`,
      ERROR_phase6: `Failed to clean up or push the changes to origin. ${cleanUpMessage}`,
      ERROR_unexpected: `Unexpected error! ${cleanUpMessage}`
    };
  }
}

// Exports
module.exports = Config;
