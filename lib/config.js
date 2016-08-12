'use strict';

// Imports
let pkg = require('../package.json');

// Classes
class Config {
  // Constructor
  constructor() {
    let defRepo = 'angular/angular.js';
    let defBranch = 'master';
    let cleanUpMsg = '(Clean-up might be needed.)';
    let usageMsg =
        `  USAGE: ${pkg.name} <PRNO> [--branch="<BRANCH>"] [--repo="<REPO>"]\n` +
        `         (Defaults: BRANCH="${defBranch}", REPO="${defRepo}")`;
    let offerToCleanUpMsg = 'Do you want me to try cleaning up for you?';

    this.defaults = {
      repo: defRepo,
      branch: defBranch
    };

    this.messages = {
      usage: usageMsg,
      offerToCleanUp: offerToCleanUpMsg,
      errors: {
        ERROR_invalidRepo: `Invalid repo. Make sure to include the username (e.g. '${defRepo}').`,
        ERROR_missingPrNo: `No PR specified.\n\n${usageMsg}`,
        ERROR_phase1: 'Failed to verify the CLA signature.',
        ERROR_phase2: `Failed to fetch the PR as a local branch. ${cleanUpMsg}`,
        ERROR_phase3: `Failed to properly merge the PR into master. ${cleanUpMsg}`,
        ERROR_phase5: `Failed to run the CI-checks or the CI-checks didn\'t pass. ${cleanUpMsg}`,
        ERROR_phase6: `Failed to clean up or push the changes to origin. ${cleanUpMsg}`,
        ERROR_phaseX: `Failed to clean up everything. ${cleanUpMsg}`,
        ERROR_unexpected: `Unexpected error! ${cleanUpMsg}`
      }
    };
  }
}

// Exports
module.exports = Config;
