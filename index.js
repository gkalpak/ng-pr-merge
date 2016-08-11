#!/usr/bin/env node
'use strict';

// Imports
let chalk = require('chalk');
let minimist = require('minimist');

// Imports - Local
let Config = require('./lib/config');
let pkg = require('./package.json');
let GitUtils = require('./lib/git-utils');
let Utils = require('./lib/utils');

// Variables - Private
let config = new Config(pkg);
let utils = new Utils(config.errorMessages);
let gUtils = new GitUtils(utils);

//Run
_main(minimist(process.argv.slice(2)));

// Functions - Definitions
function _main(args) {
  let repo = null;
  let prNo = null;
  let branch = null;
  let pushed = false;

  getAndValidateInput(args).
    then(input => {
      repo = input.repo;
      prNo = input.prNo;
      branch = input.branch;
    }).
    then(() => displayHeader(repo, prNo, branch)).
    then(() => phase1(repo, prNo)).
    then(() => phase2(repo, prNo, branch)).
    then(() => phase3(prNo, branch)).
    then(() => phase4(branch)).
    then(() => phase5()).
    then(() => phase6(prNo, branch)).
    then(pd => pushed = pd).
    then(() => theEnd(pushed)).
    catch(utils.exitWithError('ERROR_unexpected'));
}


// INPUT - VALIDATION
function getAndValidateInput(args) {
  let repo = args.repo || config.defaults.repo;
  let prNo = args._[0] || utils.exitWithError('ERROR_missingPrNo')();
  let branch = args._[1] || config.defaults.branch;

  return Promise.resolve({repo, prNo, branch});
}

// DISCLAIMER
function displayHeader(repo, prNo, branch) {
  console.log(chalk.yellow(
    '\n' +
    ':::::::::::::::::::::::::::::::::::::::::::::\n' +
    '::  WARNING:                               ::\n' +
    '::    This is still an experimental tool.  ::\n' +
    '::    Use with caution and your own risk!  ::\n' +
    ':::::::::::::::::::::::::::::::::::::::::::::\n'));

  console.log(chalk.blue.bold(`MERGING PR #${prNo} (to '${repo}#${branch}'):`));
}


// PHASE 1 (Verify CLA signature)
function phase1(repo, prNo) {
  let question = chalk.bgYellow.black('Failed to verify the CLA signature. Proceed anyway?') +
                 chalk.red(' (NOT RECOMMENDED)');

  return utils.phase(1, 'Verifying CLA signature', () => utils.
    spawnAsPromised(`${utils.getExecutable('ng-cla-check')} ${prNo} --repo="${repo}"`).
    catch(() => utils.askYesOrNoQuestion(question)));
}

// PHASE 2 (Fetch PR as local branch)
function phase2(repo, prNo, branch) {
  return utils.phase(2, 'Fetching PR as local branch', () => gUtils.
    checkout(branch).
    pull(branch, true).
    createBranch(`pr-${prNo}`).
    mergePullRequest(`https://github.com/${repo}/pull/${prNo}.patch`));
}

// PHASE 3 (Merge into master)
function phase3(prNo, branch) {
  return utils.phase(3, `Merging into '${branch}'`, () => {
    let commitCount = -1;

    return gUtils.
      countCommitsSince(branch).
      then(cc => commitCount = cc).
      then(() => gUtils.checkout(branch)).
      then(() => gUtils.rebase(`pr-${prNo}`)).
      then(() => (commitCount > 1) && gUtils.rebase(commitCount, true)).
      then(() => gUtils.updateLastCommitMessage(getNewMessage));
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
function phase4(branch) {
  return utils.phase(4, 'Inspecting changes', () => Promise.resolve().
    then(() => console.log(chalk.yellow.bold('    GIT diff:\n'))).
    then(() => utils.waitAsPromised(500)).
    then(() => gUtils.diff(`origin/${branch}`)).
    then(() => console.log(chalk.yellow.bold('\n    GIT log:\n'))).
    then(() => utils.waitAsPromised(500)).
    then(() => gUtils.log()));
}

// PHASE 5 (Run the CI-checks)
function phase5() {
  let question = chalk.bgYellow.black('Do you want to run the CI-checks now?') +
                 chalk.green(' (RECOMMENDED)');

  return utils.phase(5, 'Running the CI-checks', () => utils.
    askYesOrNoQuestion(question, true).
    then(() => {
      console.log('    Initializing the CI-checks...\n');
      return utils.spawnAsPromised(`${utils.getExecutable('grunt')} ci-checks`);
    }, utils.noop));
}

// PHASE 6 (Clean up and Push to origin)
function phase6(prNo, branch) {
  let question = chalk.bgRed.white.bold(' CAUTION ') +
                 chalk.bgYellow.black(`Do you want to push the changes to 'origin/${branch}'?`);

  return utils.phase(6, 'Cleaning up and Pushing to origin', () => gUtils.
    deleteBranch(`pr-${prNo}`).
    then(() => utils.
      askYesOrNoQuestion(question).
      then(() => gUtils.push(branch).then(() => true), () => false)));
}


// THE END
function theEnd(changesPushed) {
  console.log(chalk.green.bold('\n  OPERATION COMPLETED SUCCESSFULLY!'));
  if (!changesPushed) {
    console.log(chalk.yellow.bold('  (Don\'t forget to manually push the changes.)'));
  }
}
