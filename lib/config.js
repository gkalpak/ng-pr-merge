'use strict';

// Imports
let ngMaintainUtils = require('@gkalpak/ng-maintain-utils');

let ArgSpec = ngMaintainUtils.ArgSpec;
let ConfigBase = ngMaintainUtils.Config;

// Imports - Local
let pkg = require('../package.json');

// Variables - Private
let executable = Object.keys(pkg.bin)[0];
let defBranch = 'master';
let defRepo = 'angular/angular.js';
let usageMessage =
    `  USAGE: ${executable} <PRNO> [--branch="<BRANCH>"] [--repo="<REPO>"] [--instructions]\n` +
    `         (Defaults: BRANCH="${defBranch}", REPO="${defRepo}")`;
let branchValidator = branch => (typeof branch === 'string') && !!branch;
let repoValidator = repo => {
  let tokens = repo.split('/');
  return (tokens.length === 2) && tokens.every(t => t.trim());
};

// Classes
class Config extends ConfigBase {
  constructor() {
    let messages = {
      usage: usageMessage,
      instructionsHeaderTmpl:
          'Instructions for merging PR #{{ prNo }} to \'{{ repo }}#{{ branch }}\':',
      headerTmpl: 'Merging PR #{{ prNo }} (to \'{{ repo }}#{{ branch }}\'):',
      errors: {
        ERROR_emptyBranch: 'The target branch cannot be empty.',
        ERROR_invalidRepo: `Invalid repo. Make sure to include the username (e.g. '${defRepo}').`,
        ERROR_missingPrNo: `No PR specified.\n\n${usageMessage}`
      }
    };

    let argSpecs = [
      new ArgSpec.Unnamed(0, 'prNo', prNo => !!prNo, 'ERROR_missingPrNo'),
      new ArgSpec('branch', branchValidator, 'ERROR_emptyBranch', defBranch),
      new ArgSpec('repo', repoValidator, 'ERROR_invalidRepo', defRepo)
    ];

    super(messages, argSpecs);
  }
}

// Exports
module.exports = Config;
