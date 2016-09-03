'use strict';

// Imports
let chalk = require('chalk');
let ClaChecker = require('@gkalpak/ng-cla-check');

// Classes
class Merger {
  // Constructor
  constructor(cleanUper, utils, gUtils, input) {
    this._cleanUper = cleanUper;
    this._utils = utils;
    this._gUtils = gUtils;
    this._input = input;

    this._tempBranch = Merger.getTempBranch(input.prNo);

    this._cleanUpTasks = {
      abortRebase: this._cleanUper.registerTask(
          'Abort `git rebase`.',
          () => this._gUtils.abortRebase().catch(() => {})),
      checkoutBranch: this._cleanUper.registerTask(
          `Checkout branch '${this._input.branch}'.`,
          () => this._gUtils.checkout(this._input.branch)),
      deleteTempBranch: this._cleanUper.registerTask(
          `Delete '${this._tempBranch}'.`,
          () => this._gUtils.deleteBranch(this._tempBranch, true)),
      hardReset: this._cleanUper.registerTask(
          `Hard-reset to 'origin/${this._input.branch}'.`,
          () => this._gUtils.reset(`origin/${this._input.branch}`, true))
    };

    this._claChecker = new ClaChecker({repo: input.repo});
  }

  // Methods - Public, Static
  static getPrUrl(repo, prNo) {
    return `https://patch-diff.githubusercontent.com/raw/${repo}/pull/${prNo}.patch`;
  }

  static getTempBranch(prNo) {
    return `pr-${prNo}`;
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
    let prNo = this._input.prNo;

    let question = chalk.bgYellow.black('Failed to verify the CLA signature. Proceed anyway?') +
                   chalk.red(' (NOT RECOMMENDED)');

    return this._utils.phase(1, () => this._claChecker.check(prNo).
      catch(() => this._utils.askYesOrNoQuestion(question)));
  }

  // PHASE 2 (Fetch PR as local branch)
  phase2() {
    let repo = this._input.repo;
    let prNo = this._input.prNo;
    let branch = this._input.branch;
    let tempBranch = this._tempBranch;
    let checkoutBranchTask = this._cleanUpTasks.checkoutBranch;
    let deleteTempBranchTask = this._cleanUpTasks.deleteTempBranch;

    let prUrl = Merger.getPrUrl(repo, prNo);

    return this._utils.phase(2, () => Promise.resolve().
      then(() => this._gUtils.checkout(branch)).
      then(() => this._gUtils.pull(branch, true)).
      then(() => this._gUtils.createBranch(tempBranch)).
      then(() => this._cleanUper.schedule(deleteTempBranchTask)).
      then(() => this._cleanUper.schedule(checkoutBranchTask)).
      then(() => this._gUtils.mergePullRequest(prUrl)));
  }

  // PHASE 3 (Merge into target branch)
  phase3() {
    let prNo = this._input.prNo;
    let branch = this._input.branch;
    let tempBranch = this._tempBranch;
    let abortRebaseTask = this._cleanUpTasks.abortRebase;
    let checkoutBranchTask = this._cleanUpTasks.checkoutBranch;
    let deleteTempBranchTask = this._cleanUpTasks.deleteTempBranch;
    let hardResetTask = this._cleanUpTasks.hardReset;

    return this._utils.phase(3, () => {
      let commitCount = -1;

      return Promise.resolve().
        then(() => this._gUtils.countCommitsSince(branch)).
        then(cc => commitCount = cc).
        then(() => this._gUtils.checkout(branch)).
        then(() => this._cleanUper.unschedule(checkoutBranchTask)).
        then(() => this._cleanUper.withTask(abortRebaseTask, () =>
          this._gUtils.rebase(tempBranch))).
        then(() => this._cleanUper.withTask(hardResetTask, () => Promise.resolve().
          then(() => this._gUtils.deleteBranch(tempBranch, true)).
          then(() => this._cleanUper.unschedule(deleteTempBranchTask)).
          then(() => (commitCount > 1) && this._cleanUper.withTask(abortRebaseTask, () =>
            this._gUtils.rebase(commitCount, true))).
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

    return this._utils.phase(4, () => Promise.resolve().
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

    return this._utils.phase(5, () => this._utils.
      askYesOrNoQuestion(question, true).
      then(() => {
        console.log('    Initializing the CI-checks...\n');
        return this._utils.spawnAsPromised(this._utils.getRunWithNodeCmd('grunt', ['ci-checks']));
      }, () => {}));
  }

  // PHASE 6 (Push to origin)
  phase6() {
    let branch = this._input.branch;

    let question = chalk.bgRed.white.bold(' CAUTION ') +
                   chalk.bgYellow.black(`Do you want to push the changes to 'origin/${branch}'?`);

    return this._utils.phase(6, () => this._utils.
      askYesOrNoQuestion(question).
      then(() => this._gUtils.push(branch).then(() => true), () => false));
  }
}

// Exports
module.exports = Merger;
