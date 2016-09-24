'use strict';

// Imports
let chalk = require('chalk');
let ClaChecker = require('@gkalpak/ng-cla-check');
let ngMaintainUtils = require('@gkalpak/ng-maintain-utils');
let path = require('path');

let Phase = ngMaintainUtils.Phase;

// Classes
class Merger {
  // Constructor
  constructor(cleanUper, utils, uiUtils, gitUtils, input) {
    this._cleanUper = cleanUper;
    this._utils = utils;
    this._uiUtils = uiUtils;
    this._gitUtils = gitUtils;
    this._input = input;

    this._claChecker = new ClaChecker({repo: input.repo});

    this._phases = Merger.getPhases();
    this._tempBranch = Merger.getTempBranch(input.prNo);

    this._cleanUpTasks = {
      abortRebase: this._cleanUper.registerTask(
          'Abort `git rebase`.',
          () => this._gitUtils.abortRebase().catch(() => {})),
      cleanUntracked: this._cleanUper.registerTask(
          'Remove untracked files, such as \'*.orig\' (if any).',
          () => this._cleanUntrackedFiles()),
      checkoutBranch: this._cleanUper.registerTask(
          `Checkout branch '${this._input.branch}'.`,
          () => this._gitUtils.checkout(this._input.branch)),
      deleteTempBranch: this._cleanUper.registerTask(
          `Delete '${this._tempBranch}'.`,
          () => this._gitUtils.deleteBranch(this._tempBranch, true)),
      hardReset: this._cleanUper.registerTask(
          `Hard-reset to 'origin/${this._input.branch}'.`,
          () => this._gitUtils.reset(`origin/${this._input.branch}`, true))
    };
  }

  // Methods - Protected
  _cleanUntrackedFiles() {
    return this._gitUtils.clean();
  }

  _getCiChecksCmd() {
    let nodeExecutable = process.execPath;
    let scriptFile = path.join(process.cwd(), 'node_modules/grunt/bin/grunt');

    return `"${nodeExecutable}" "${scriptFile}" ci-checks`;
  }

  _getNewMessage(oldMessage) {
    let prNo = this._input.prNo;

    let closingNotes = [
      'close', 'closes', 'closed',
      'fix', 'fixes', 'fixed',
      'resolve', 'resolves', 'resolved'
    ].map(keyword => new RegExp(`(?:^|\\n)\\s*${keyword} #${prNo}(?:\\D|$)`, 'i'));

    let newMessage = oldMessage.trim().replace(/\r\n/g, '\n');
    let containsNote = closingNotes.some(noteRe => noteRe.test(newMessage));

    if (!containsNote) {
      newMessage = newMessage.replace(/(\n\s*BREAKING CHANGE:|$)/, `\n\nCloses #${prNo}$1`);
    }

    return newMessage;
  }

  // Methods - Public, Static
  static getPhases() {
    return [
      new Phase('1', 'Verifying CLA signature', [
        '`ng-cla-check {{ prNo }} --repo="{{ repo }}"`'
      ], 'Failed to verify the CLA signature.'),
      new Phase('2', 'Fetching PR as local branch', [
        '`git checkout {{ branch }}`',
        '`git pull --rebase origin {{ branch }}`',
        '`git checkout -b {{ tempBranch }}`',
        '`curl {{ prUrl }} | git am -3`'
      ], 'Failed to fetch the PR as a local branch.'),
      new Phase('3', 'Merging into target branch', [
        '`git rev-list --count {{ branch }}..HEAD` (--> <COMMIT_COUNT>)',
        '`git checkout {{ branch }}`',
        '`git rebase {{ tempBranch }}`',
        '`git branch -D {{ tempBranch }}`',
        '[`git rebase --interactive HEAD~<COMMIT_COUNT>`]',
        '`git commit --amend` (+ Closes #{{ prNo }})'
      ], 'Failed to properly merge the PR into the target branch.'),
      new Phase('4', 'Inspecting changes', [
        '`git diff origin/{{ branch }}`',
        '`git log`'
      ]),
      new Phase('5', 'Cleaning untracted files', [
        '`git clean --interactive`'
      ], 'Failed to clean untracked files.'),
      new Phase('6', 'Running the CI-checks', [
        '`grunt ci-checks`'
      ], 'Failed to run the CI-checks or the CI-checks didn\'t pass.'),
      new Phase('7', 'Pushing to origin', [
        '`git push origin {{ branch }}`'
      ], 'Failed to push the changes to origin.')
    ];
  }

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
      then(() => this.phase6()).
      then(() => this.phase7());
  }

  // PHASE 1 (Verify CLA signature)
  phase1() {
    let phase = this._phases[0];
    let prNo = this._input.prNo;

    let question = chalk.bgYellow.black('Failed to verify the CLA signature. Proceed anyway?') +
                   chalk.red(' (NOT RECOMMENDED)');

    return this._uiUtils.phase(phase, () => this._claChecker.check(prNo).
      catch(() => this._uiUtils.askYesOrNoQuestion(question)));
  }

  // PHASE 2 (Fetch PR as local branch)
  phase2() {
    let phase = this._phases[1];
    let repo = this._input.repo;
    let prNo = this._input.prNo;
    let branch = this._input.branch;
    let tempBranch = this._tempBranch;
    let checkoutBranchTask = this._cleanUpTasks.checkoutBranch;
    let cleanUntrackedTask = this._cleanUpTasks.cleanUntracked;
    let deleteTempBranchTask = this._cleanUpTasks.deleteTempBranch;

    let prUrl = Merger.getPrUrl(repo, prNo);

    return this._uiUtils.phase(phase, () => Promise.resolve().
      then(() => this._gitUtils.checkout(branch)).
      then(() => this._cleanUper.schedule(cleanUntrackedTask)).
      then(() => this._gitUtils.pull(branch, true)).
      then(() => this._gitUtils.createBranch(tempBranch)).
      then(() => this._cleanUper.schedule(deleteTempBranchTask)).
      then(() => this._cleanUper.schedule(checkoutBranchTask)).
      then(() => this._gitUtils.mergePullRequest(prUrl)));
  }

  // PHASE 3 (Merge into target branch)
  phase3() {
    let phase = this._phases[2];
    let branch = this._input.branch;
    let tempBranch = this._tempBranch;
    let abortRebaseTask = this._cleanUpTasks.abortRebase;
    let checkoutBranchTask = this._cleanUpTasks.checkoutBranch;
    let deleteTempBranchTask = this._cleanUpTasks.deleteTempBranch;
    let hardResetTask = this._cleanUpTasks.hardReset;

    return this._uiUtils.phase(phase, () => {
      let commitCount = -1;
      let getNewMessage = oldMessage => this._getNewMessage(oldMessage);

      return Promise.resolve().
        then(() => this._gitUtils.countCommitsSince(branch)).
        then(cc => commitCount = cc).
        then(() => this._gitUtils.checkout(branch)).
        then(() => this._cleanUper.unschedule(checkoutBranchTask)).
        then(() => this._cleanUper.withTask(abortRebaseTask, () =>
          this._gitUtils.rebase(tempBranch))).
        then(() => this._cleanUper.withTask(hardResetTask, () => Promise.resolve().
          then(() => this._gitUtils.deleteBranch(tempBranch, true)).
          then(() => this._cleanUper.unschedule(deleteTempBranchTask)).
          then(() => (commitCount > 1) && this._cleanUper.withTask(abortRebaseTask, () =>
            this._gitUtils.rebase(commitCount, true))).
          then(() => this._gitUtils.updateLastCommitMessage(getNewMessage))));
    });
  }

  // PHASE 4 (Inspect changes)
  phase4() {
    let phase = this._phases[3];
    let branch = this._input.branch;

    return this._uiUtils.phase(phase, () => Promise.resolve().
      then(() => console.log(chalk.yellow.bold('    GIT diff:\n'))).
      then(() => this._utils.waitAsPromised(500)).
      then(() => this._gitUtils.diffWithHighlight(`origin/${branch}`)).
      then(() => console.log(chalk.yellow.bold('\n    GIT log:\n'))).
      then(() => this._utils.waitAsPromised(500)).
      then(() => this._gitUtils.log()));
  }

  // PHASE 5 (Clean untracked files)
  phase5() {
    let phase = this._phases[4];
    let cleanUntrackedTask = this._cleanUpTasks.cleanUntracked;

    return this._uiUtils.phase(phase, () => Promise.resolve().
      then(() => this._cleanUntrackedFiles()).
      then(() => this._cleanUper.unschedule(cleanUntrackedTask)));
  }

  // PHASE 6 (Run the CI-checks)
  phase6() {
    let phase = this._phases[5];
    let question = chalk.bgYellow.black('Do you want to run the CI-checks now?') +
                   chalk.green(' (RECOMMENDED)');

    return this._uiUtils.phase(phase, () => this._uiUtils.
      askYesOrNoQuestion(question, true).
      then(() => {
        console.log('    Initializing the CI-checks...\n');
        return this._utils.spawnAsPromised(this._getCiChecksCmd());
      }, () => {}));
  }

  // PHASE 7 (Push to origin)
  phase7() {
    let phase = this._phases[6];
    let branch = this._input.branch;

    let question = chalk.bgRed.white.bold(' CAUTION ') +
                   chalk.bgYellow.black(`Do you want to push the changes to 'origin/${branch}'?`);

    return this._uiUtils.phase(phase, () => this._uiUtils.
      askYesOrNoQuestion(question).
      then(() => this._gitUtils.push(branch).then(() => true), () => false));
  }
}

// Exports
module.exports = Merger;
