'use strict';

// Imports
let chalk = require('chalk');

// Classes
class Merger {
  // Constructor
  constructor(utils, gUtils, input) {
    this.utils = utils;
    this.gUtils = gUtils;
    this.input = input;

    this.tempBranch = `pr-${input.prNo}`;
  }

  // Methods - Public
  merge() {
    return Promise.resolve().
      then(() => this.phase1()).
      then(() => this.phase2()).
      then(() => this.phase3()).
      then(() => this.phase4()).
      then(() => this.phase5()).
      then(() => this.phase6());
  }

  // PHASE 1 (Verify CLA signature)
  phase1() {
    let repo = this.input.repo;
    let prNo = this.input.prNo;

    let question = chalk.bgYellow.black('Failed to verify the CLA signature. Proceed anyway?') +
                   chalk.red(' (NOT RECOMMENDED)');

    return this.utils.phase(1, 'Verifying CLA signature', () => this.utils.
      spawnAsPromised(`${this.utils.getExecutable('ng-cla-check')} ${prNo} --repo="${repo}"`).
      catch(() => this.utils.askYesOrNoQuestion(question)));
  }

  // PHASE 2 (Fetch PR as local branch)
  phase2() {
    let repo = this.input.repo;
    let prNo = this.input.prNo;
    let branch = this.input.branch;
    let tempBranch = this.tempBranch;

    return this.utils.phase(2, 'Fetching PR as local branch', () => this.gUtils.
      checkout(branch).
      pull(branch, true).
      createBranch(tempBranch).
      mergePullRequest(`https://github.com/${repo}/pull/${prNo}.patch`));
  }

  // PHASE 3 (Merge into master)
  phase3() {
    let prNo = this.input.prNo;
    let branch = this.input.branch;
    let tempBranch = this.tempBranch;

    return this.utils.phase(3, `Merging into '${branch}'`, () => {
      let commitCount = -1;

      return this.gUtils.
        countCommitsSince(branch).
        then(cc => commitCount = cc).
        then(() => this.gUtils.checkout(branch)).
        then(() => this.gUtils.rebase(tempBranch)).
        then(() => (commitCount > 1) && this.gUtils.rebase(commitCount, true)).
        then(() => this.gUtils.updateLastCommitMessage(getNewMessage));
    });

    // Helpers
    function getNewMessage(oldMessage) {
      return oldMessage.
        trim().
        replace(/\r\n/g, '\n').
        replace(/(\n\s*BREAKING CHANGE:|$)/, `\n\nCloses #${prNo}$1`);
    }
  }

  // PHASE 4 (Inspect changes)
  phase4() {
    let branch = this.input.branch;

    return this.utils.phase(4, 'Inspecting changes', () => Promise.resolve().
      then(() => console.log(chalk.yellow.bold('    GIT diff:\n'))).
      then(() => this.utils.waitAsPromised(500)).
      then(() => this.gUtils.diff(`origin/${branch}`)).
      then(() => console.log(chalk.yellow.bold('\n    GIT log:\n'))).
      then(() => this.utils.waitAsPromised(500)).
      then(() => this.gUtils.log()));
  }

  // PHASE 5 (Run the CI-checks)
  phase5() {
    let question = chalk.bgYellow.black('Do you want to run the CI-checks now?') +
                   chalk.green(' (RECOMMENDED)');

    return this.utils.phase(5, 'Running the CI-checks', () => this.utils.
      askYesOrNoQuestion(question, true).
      then(() => {
        console.log('    Initializing the CI-checks...\n');
        return this.utils.spawnAsPromised(`${this.utils.getExecutable('grunt')} ci-checks`);
      }, () => {}));
  }

  // PHASE 6 (Clean up and Push to origin)
  phase6() {
    let branch = this.input.branch;
    let tempBranch = this.tempBranch;

    let question = chalk.bgRed.white.bold(' CAUTION ') +
                   chalk.bgYellow.black(`Do you want to push the changes to 'origin/${branch}'?`);

    return this.utils.phase(6, 'Cleaning up and Pushing to origin', () => this.gUtils.
      deleteBranch(tempBranch).
      then(() => this.utils.
        askYesOrNoQuestion(question).
        then(() => this.gUtils.push(branch).then(() => true), () => false)));
  }
}

// Exports
module.exports = Merger;
