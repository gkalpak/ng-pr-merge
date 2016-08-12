'use strict';

// Imports
let https = require('https');

// Classes
class GitUtils {
  // Constructor
  constructor(utils, cleanUper) {
    this._utils = utils;
    this._cleanUper = cleanUper;
  }

  // Methods - Public
  abortAm() {
    return this._utils.spawnAsPromised('git am --abort');
  }

  abortRebase() {
    return this._utils.spawnAsPromised('git rebase --abort');
  }

  checkout(branch) {
    return this._utils.spawnAsPromised(`git checkout ${branch}`);
  }

  countCommitsSince(commit) {
    return this._utils.execAsPromised(`git rev-list --count ${commit}..HEAD`).
      then(response => parseInt(response.toString().trim(), 10));
  }

  createBranch(branch) {
    return this._utils.spawnAsPromised(`git checkout -b ${branch}`);
  }

  deleteBranch(branch, force) {
    let forceOpt = force ? ' --force' : '';

    return this._utils.spawnAsPromised(`git branch --delete${forceOpt} ${branch}`);
  }

  diff(commit) {
    return this._utils.spawnAsPromised(`git diff ${commit}`);
  }

  getCommitMessage(commit) {
    return this._utils.execAsPromised(`git show --no-patch --format=%B ${commit}`).
      then(message => message.toString());
  }

  getLastCommitMessage() {
    return this.getCommitMessage('HEAD');
  }

  log(oneline, count) {
    let onelineOpt = oneline ? ' --oneline' : '';
    let countOpt = count ? ` -${count}` : '';

    return this._utils.spawnAsPromised(`git log${onelineOpt}${countOpt}`).
      // `git log` has an exit code !== 0 if paged
      catch(() => {});
  }

  mergePullRequest(url) {
    // WARNING: Does not follow redirections :(
    //          To support redirection: this._utils.spawnAsPromised(`curl -L ${url} | git am -3`)
    return new Promise((resolve, reject) => {
      let abortAm = () => this.abortAm();
      let cb = res => this._cleanUper.
        withTask(abortAm, () => this._utils.spawnAsPromised('git am -3', res)).
        then(resolve, reject);

      https.
        get(url, cb).
        on('error', reject);
    });
  }

  pull(branch, rebase) {
    let rebaseOpt = rebase ? ' --rebase' : '';

    return this._utils.spawnAsPromised(`git pull${rebaseOpt} origin ${branch}`);
  }

  push(branch) {
    return this._utils.spawnAsPromised(`git push origin ${branch}`);
  }

  rebase(commit, interactive) {
    if (typeof commit === 'number') commit = `HEAD~${commit}`;

    let interactiveOpt = interactive ? ' --interactive' : '';

    return this._utils.spawnAsPromised(`git rebase${interactiveOpt} ${commit}`);
  }

  reset(commit, hard) {
    let hardOpt = hard ? ' --hard' : '';

    return this._utils.spawnAsPromised(`git reset${hardOpt} ${commit}`);
  }

  setLastCommitMessage(message) {
    // Hack: The only cross-platform way I could come up with
    // for programmatically setting multi-line commit messages
    let tempFile = `.temp-commit-message_${Date.now()}.txt`;
    let finallyCb = () => this._utils.unlinkAsPromised(tempFile);

    return Promise.resolve().
      then(() => this._utils.writeFileAsPromised(tempFile, message)).
      then(() => this._utils.spawnAsPromised(`git commit --amend --file=${tempFile}`)).
      then(finallyCb, finallyCb);
  }

  updateLastCommitMessage(getNewMessage) {
    return this.getLastCommitMessage().
      then(oldMessage => getNewMessage(oldMessage)).
      then(newMessage => this.setLastCommitMessage(newMessage));
  }
}

// Exports
module.exports = GitUtils;
