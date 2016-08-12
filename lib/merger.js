'use strict';

// Imports
let chalk = require('chalk');

// Classes
class Merger {

  // Constructor
  constructor(utils, gUtils, cleanUper, input) {
    this._utils = utils;
    this._gUtils = gUtils;
    this._cleanUper = cleanUper;
    this._input = input;

    this._tempBranch = `pr-${input.prNo}`;
  }

  // Methods - Protected
  _cleanUp_checkoutBranch() {
    let branch = this._input.branch;

    return this._gUtils.checkout(branch);
  }

  _cleanUp_deleteTempBranch() {
    let tempBranch = this._input.tempBranch;

    return this._gUtils.deleteBranch(tempBranch, true);
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
    let repo = this._input.repo;
    let prNo = this._input.prNo;

    let question = chalk.bgYellow.black('Failed to verify the CLA signature. Proceed anyway?') +
                   chalk.red(' (NOT RECOMMENDED)');

    return this._utils.phase(1, 'Verifying CLA signature', () => this._utils.
      spawnAsPromised(`${this._utils.getExecutable('ng-cla-check')} ${prNo} --repo="${repo}"`).
      catch(() => this._utils.askYesOrNoQuestion(question)));
  }

  // PHASE 2 (Fetch PR as local branch)
  phase2() {
    let repo = this._input.repo;
    let prNo = this._input.prNo;
    let branch = this._input.branch;
    let tempBranch = this._tempBranch;

    let url = `https://patch-diff.githubusercontent.com/raw/${repo}/pull/${prNo}.patch`;

    return this._utils.phase(2, 'Fetching PR as local branch', () => Promise.resolve().
      then(() => this._gUtils.checkout(branch)).
      then(() => this._gUtils.pull(branch, true)).
      then(() => this._gUtils.createBranch(tempBranch)).
      then(() => this._cleanUper.register([
        this._cleanUp_deleteTempBranch,
        this._cleanUp_checkoutBranch
      ])).
      then(() => this._gUtils.mergePullRequest(url)));
  }

  // PHASE 3 (Merge into master)
  phase3() {
    let prNo = this._input.prNo;
    let branch = this._input.branch;
    let tempBranch = this._tempBranch;

    return this._utils.phase(3, `Merging into '${branch}'`, () => {
      let commitCount = -1;
      let abortRebase = () => this.gUtils.abortRebase();

      return Promise.resolve().
        then(() => this._gUtils.countCommitsSince(branch)).
        then(cc => commitCount = cc).
        then(() => this._gUtils.checkout(branch)).
        then(() => this._cleanUper.unregister(this._cleanUp_checkoutBranch)).
        then(() => this._cleanUper.withTask(abortRebase, () => Promise.resolve().
          then(() => this._gUtils.rebase(tempBranch)).
          then(() => (commitCount > 1) && this._gUtils.rebase(commitCount, true)))).
          then(() => this._gUtils.updateLastCommitMessage(getNewMessage))));
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
    let branch = this._input.branch;

    return this._utils.phase(4, 'Inspecting changes', () => Promise.resolve().
      then(() => console.log(chalk.yellow.bold('    GIT diff:\n'))).
      then(() => this._utils.waitAsPromised(500)).
      then(() => this._gUtils.diff(`origin/${branch}`)).
      then(() => console.log(chalk.yellow.bold('\n    GIT log:\n'))).
      then(() => this._utils.waitAsPromised(500)).
      then(() => this._gUtils.log()));
  }

  // PHASE 5 (Run the CI-checks)
  phase5() {
    let question = chalk.bgYellow.black('Do you want to run the CI-checks now?') +
                   chalk.green(' (RECOMMENDED)');

    return this._utils.phase(5, 'Running the CI-checks', () => this._utils.
      askYesOrNoQuestion(question, true).
      then(() => {
        console.log('    Initializing the CI-checks...\n');
        return this._utils.spawnAsPromised(`${this._utils.getExecutable('grunt')} ci-checks`);
      }, () => {}));
  }

  // PHASE 6 (Push to origin)
  phase6() {
    let branch = this._input.branch;
    let tempBranch = this._tempBranch;

    let question = chalk.bgRed.white.bold(' CAUTION ') +
                   chalk.bgYellow.black(`Do you want to push the changes to 'origin/${branch}'?`);

    return this._utils.phase(6, 'Cleaning up and Pushing to origin', () => this._gUtils.
      deleteBranch(tempBranch, true).
      then(() => this._cleanUper.unregister(this._cleanUp_deleteTempBranch)).
      then(() => this._utils.
        askYesOrNoQuestion(question).
        then(() => this._gUtils.push(branch).then(() => true), () => false)));
  }
}

// Exports
module.exports = Merger;
