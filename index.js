#!/usr/bin/env node
'use strict';

// Constants
const PACKAGE_NAME = require('./package.json').name;
const CLEAN_UP_MSG = '(Clean-up might be needed.)';
const ERRORS = {
  ERROR_missingPrNo: `No PR specified\n\nUSAGE: ${PACKAGE_NAME} <PRNO>`,
  ERROR_phase1: 'Failed to verify the CLA signature.',
  ERROR_phase2: `Failed to fetch the PR as a local branch. ${CLEAN_UP_MSG}`,
  ERROR_phase3: `Failed to properly merge the PR into master. ${CLEAN_UP_MSG}`,
  ERROR_phase5: `Failed to run the CI-checks or the CI-checks didn\'t pass. ${CLEAN_UP_MSG}`,
  ERROR_phase6: `Failed to clean up or push the changes to origin. ${CLEAN_UP_MSG}`,
  ERROR_unexpected: 'Unexpected error! ${CLEAN_UP_MSG}'
};

// Imports
let fs = require('fs');
let proc = require('child_process');
let readline = require('readline');

// Variables - Private
let execAsPromised = asPromised(proc.exec, proc);
let writeFileAsPromised = asPromised(fs.writeFile, fs);
let unlinkAsPromised = asPromised(fs.unlink, fs);

//Run
_main(process.argv.slice(2));

// Functions - Definitions
function _main(args) {
  let repo;
  let prNo;
  let changesPushed = false;

  getAndValidateInput(args).
    then(input => ({repo, prNo} = input)).
    then(() => displayHeader(prNo)).
    then(() => phase1(prNo)).
    then(() => phase2(repo, prNo)).
    then(() => phase3(repo, prNo)).
    then(() => phase4()).
    then(() => phase5()).
    then(() => phase6(prNo)).
    then(cp => changesPushed = cp).
    then(() => theEnd(changesPushed)).
    catch(exitWithError('ERROR_unexpected'));
}

// -------------------------------------------------------------------------------------------------

// INPUT - VALIDATION
function getAndValidateInput(args) {
  let repo = process.env.NGPR_REPO || 'angular.js';
  let prno = args[0];

  if (!prno) exitWithError('ERROR_missingPrNo')();

  return Promise.resolve({repo, prno});
}

// DISCLAIMER
function displayHeader(prNo) {
  console.log(
    '::::::::::::::::::::::::::::::::::' +
    '::  WARNING:                    ::' +
    '::    Highly experimental tool  ::' +
    '::    Use with extreme caution  ::' +
    '::::::::::::::::::::::::::::::::::');
  console.log(`MERGING PR #${prNo}:`);
}


// PHASE 1
function phase1(prNo) {
  let proceedWithoutCla = 'Failed to verify the CLA signature. Proceed anyway (NOT RECOMMENDED)?';

  return phase(1, 'Verifying CLA signature', () =>
    execAsPromised(`ng-cla-check ${prNo}`).
      catch(() => askYesOrNoQuestion(proceedWithoutCla)));
}

// PHASE 2
function phase2(repo, prNo) {
  let cmds = [
    'git checkout master',
    'git pull --rebase origin master',
    `git checkout -b pr-${prNo}`,
    `curl -L https://github.com/angular/${repo}/pull/${prNo}.patch | git am -3`
  ];

  return phase(2, 'Fetching PR as local branch', () => execAsPromised(cmds.join(' && ')));
}

// PHASE 3
function phase3(repo, prNo) {
  let cmds = [
    'git checkout master',
    `git rebase pr-${prNo}`
  ];

  return phase(3, 'Merging into master', () =>
    getCommitCount().
      then(count => { if (count > 1) cmds.push(`git rebase -i HEAD~${count}`); }).
      then(() => execAsPromised(cmds.join(' && '))).
      then(() => updateCommitMessage(prNo)));

  // Helpers
  function getCommitCount() {
    return execAsPromised('git rev-list --count master..HEAD').
      then(response => parseInt(response.toString().trim(), 10));
  }

  function updateCommitMessage(prNo) {
    return execAsPromised('git show --no-patch --format=%B HEAD').
      then(oldMsg => oldMsg.
        toString().
        trim().
        replace(/\r\n/g, '\n').
        replace(/(\n\s*BREAKING CHANGE:|$)/, `\n\nCloses #${prNo}$1`)).
      then(newMsg => {
        // Hack: The only cross-platform way I could come up with
        // for programmatically setting multi-line commit messages
        let tempFile = `.temp-commit-message_${Date.now()}.txt`;

        return writeFileAsPromised(tempFile, newMsg).
          then(() => execAsPromised(`git commit --amend --file=${tempFile}`)).
          finally(() => unlinkAsPromised(tempFile));
      });
  }
}

// PHASE 4
function phase4() {
  return phase(4, 'Inspecting changes', () => {
    console.log('    GIT diff:');
    return execAsPromised('git diff origin/master').
      catch(noop).
      then(() => console.log('    GIT log:')).
      then(() => execAsPromised('git log')).
      catch(noop);
  });
}

// PHASE 5
function phase5() {
  return phase(5, 'Running the CI-checks', () =>
    askYesOrNoQuestion('Do you want to run the CI-checks now (RECOMMENDED)?', true).
      then(() => {
        console.log('   Initializing the CI-checks...');
        return execAsPromised('grunt ci-checks');
      }, noop));
}

// PHASE 6
function phase6(prNo) {
  return phase(6, 'Cleaning up and Pushing to origin', () =>
    execAsPromised(`git branch -D pr-${prNo}`).
      then(() => askYesOrNoQuestion('CAUTION: Do you want to push the changes to origin/master?').
        then(() => execAsPromised('git push origin master').then(() => true),
             () => false)));
}

// THE END
function theEnd(changesPushed) {
  console.log('\nOPERATION COMPLETED SUCCESSFULLY!');
  if (!changesPushed) {
    console.log('(Don\'t forget to manually push the changes.)');
  }
}

// -------------------------------------------------------------------------------------------------

// Utilities
function askQuestion(question) {
  return new Promise(resolve => {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`\n${question}`, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

function askYesOrNoQuestion(question, defaultToYes) {
  return new Promise((resolve, reject) => {
    let answerOptions = defaultToYes ? '[Y/n]' : '[y/N]';

    askQuestion(`${question} ${answerOptions}: `).then(answer => {
      let nonDefaultAnswer = defaultToYes ? 'no' : 'yes';
      let gaveNonDefaultAnswer = matchesAnswer(answer, nonDefaultAnswer);
      let yes = (!defaultToYes && gaveNonDefaultAnswer) || (defaultToYes && !gaveNonDefaultAnswer);

      (yes ? resolve : reject)();
    });
  });

  // Helpers
  function matchesAnswer(actual, expected) {
    let actualLc = actual.toLowerCase();
    let expectedLc = expected.toLowerCase();

    return (actualLc === expectedLc) || (actualLc[0] === expectedLc[0]);
  }
}

function asPromised(fn, context) {
  return function doAsPromised() {
    let args = Array.prototype.slice.call(arguments);

    return new Promise((resolve, reject) => {
      args.push((err, output) => {
        if (err) return reject(err);

        resolve(output);
      });

      fn.apply(context, args);
    });
  };
}

function exitWithError(errCode) {
  return function onError(err) {
    let errMsg = ERRORS[errCode] || errCode || '<no error code>';

    if (err) {
      console.error(err);
    }
    console.error(`\nERROR: ${errMsg}\n\nOPERATION ABORTED!`);

    process.exit(1);
  };
}

function noop() {}

function phase(phaseNo, description, doWork) {
  console.log(`\n\nPHASE ${phaseNo} - ${description}...\n`);

  return doWork().
    then(output => {
      console.log('\n  ...done');
      return output;
    }).
    catch(exitWithError(`ERROR_phase${phaseNo}`));
}
