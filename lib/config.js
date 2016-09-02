'use strict';

// Imports
let pkg = require('../package.json');

// Classes
class Config {
  // Constructor
  constructor() {
    let executable = Object.keys(pkg.bin)[0];

    let defRepo = 'angular/angular.js';
    let defBranch = 'master';
    let cleanUpMsg = '(Clean-up might be needed.)';
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
      phases: {
        1: {
          description: 'Verifying CLA signature',
          instructions: [
            '`ng-cla-check ${prNo} --repo="${repo}"`'
          ]
        },
        2: {
          description: 'Fetching PR as local branch',
          instructions: [
            '`git checkout ${branch}`',
            '`git pull --rebase origin ${branch}`',
            '`git checkout -b ${tempBranch}`',
            '`curl ${prUrl} | git am -3`'
          ]
        },
        3: {
          description: 'Merging into target branch',
          instructions: [
            '`git rev-list --count ${branch}..HEAD` (--> <COMMIT_COUNT>)',
            '`git checkout ${branch}`',
            '`git rebase ${tempBranch}`',
            '`git branch --delete --force ${tempBranch}`',
            '[`git rebase --interactive HEAD~<COMMIT_COUNT>`]',
            '`git commit --amend` (+ Closes #${prNo})'
          ]
        },
        4: {
          description: 'Inspecting changes',
          instructions: [
            '`git diff origin/${branch}`',
            '`git log`'
          ]
        },
        5: {
          description: 'Running the CI-checks',
          instructions: [
            '`grunt ci-checks`'
          ]
        },
        6: {
          description: 'Pushing to origin',
          instructions: [
            '`git push origin ${branch}`'
          ]
        },
        X: {
          description: 'Trying to clean up the mess',
          instructions: []
        }
      },
      errors: {
        ERROR_invalidRepo: `Invalid repo. Make sure to include the username (e.g. '${defRepo}').`,
        ERROR_missingPrNo: `No PR specified.\n\n${usageMsg}`,
        ERROR_phase1: 'Failed to verify the CLA signature.',
        ERROR_phase2: `Failed to fetch the PR as a local branch. ${cleanUpMsg}`,
        ERROR_phase3: `Failed to properly merge the PR into master. ${cleanUpMsg}`,
        ERROR_phase4: '',
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
