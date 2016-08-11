'use strict';

// Classes
class GitUtils {
  // Constructor
  constructor(utils) {
    this.utils = utils;
  }

  // Methods - Public
  checkout(branch) {
    return this.utils.spawnAsPromised(`git checkout ${branch}`);
  }

  countCommitsSince(commit) {
    return this.utils.execAsPromised(`git rev-list --count ${commit}..HEAD`).
      then(response => parseInt(response.toString().trim(), 10));
  }

  createBranch(branch) {
    return this.utils.spawnAsPromised(`git checkout -b ${branch}`);
  }

  deleteBranch(branch, force) {
    let forceOpt = force ? ' --force' : '';

    return this.utils.spawnAsPromised(`git branch --delete${forceOpt} ${branch}`);
  }

  diff(commit) {
    return this.utils.spawnAsPromised(`git diff ${commit}`);
  }

  getCommitMessage(commit) {
    return this.utils.execAsPromised(`git show --no-patch --format=%B ${commit}`).
      then(message => message.toString());
  }

  getLastCommitMessage() {
    return this.getCommitMessage('HEAD');
  }

  log(oneline, count) {
    let onelineOpt = oneline ? ' --oneline' : '';
    let countOpt = count ? ` -${count}` : '';

    return this.utils.spawnAsPromised(`git log${onelineOpt}${countOpt}`).
      // `git log` has an exit code !== 0 if paged
      catch(this.utils.noop);
  }

  mergePullRequest(url) {
    return this.utils.spawnAsPromised(`curl -L ${url} | git am -3`);
  }

  pull(branch, rebase) {
    let rebaseOpt = rebase ? ' --rebase' : '';

    return this.utils.spawnAsPromised(`git pull${rebaseOpt} origin ${branch}`);
  }

  push(branch) {
    return this.utils.spawnAsPromised(`git push origin ${branch}`);
  }

  rebase(commit, interactive) {
    if (typeof commit === 'number') commit = `HEAD~${commit}`;

    let interactiveOpt = interactive ? ' --interactive' : '';

    return this.utils.spawnAsPromised(`git rebase${interactiveOpt} ${commit}`);
  }

  setLastCommitMessage(message) {
    // Hack: The only cross-platform way I could come up with
    // for programmatically setting multi-line commit messages
    let tempFile = `.temp-commit-message_${Date.now()}.txt`;
    let finallyCb = () => this.utils.unlinkAsPromised(tempFile);

    return this.utils.writeFileAsPromised(tempFile, message).
      then(() => this.utils.spawnAsPromised(`git commit --amend --file=${tempFile}`)).
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
