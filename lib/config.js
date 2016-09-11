'use strict';

// Imports
let Phase = require('./phase');
let pkg = require('../package.json');

// Classes
class Config {
  // Constructor
  constructor() {
    let executable = Object.keys(pkg.bin)[0];

    let defRepo = 'angular/angular.js';
    let defBranch = 'master';
    let usageMsg =
        `  USAGE: ${executable} <PRNO> [--branch="<BRANCH>"] [--repo="<REPO>"] [--instructions]\n` +
        `         (Defaults: BRANCH="${defBranch}", REPO="${defRepo}")`;
    let offerToCleanUpMsg = 'Do you want me to try cleaning up for you?';

    this.defaults = {
      repo: defRepo,
      branch: defBranch
    };

    this.messages = {
      usage: usageMsg,
      offerToCleanUp: offerToCleanUpMsg,
      cleanUpPhase: new Phase('X', 'Trying to clean up the mess', [],
                              'Failed to clean up everything.'),
      errors: {
        ERROR_invalidRepo: `Invalid repo. Make sure to include the username (e.g. '${defRepo}').`,
        ERROR_missingPrNo: `No PR specified.\n\n${usageMsg}`,
        ERROR_unexpected: 'Something went wrong (and that\'s all I know)!'
      }
    };
  }
}

// Exports
module.exports = Config;
