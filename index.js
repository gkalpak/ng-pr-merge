#!/usr/bin/env node
'use strict';

// Constants
const PACKAGE_NAME = require('./package.json').name;
const CLEAN_UP_MSG = '(Clean-up might be needed.)';
const ERRORS = {
  ERROR_missingPrNo: `No PR specified\n\n  USAGE: ${PACKAGE_NAME} <PRNO>`,
  ERROR_phase1: 'Failed to verify the CLA signature.',
  ERROR_phase2: `Failed to fetch the PR as a local branch. ${CLEAN_UP_MSG}`,
  ERROR_phase3: `Failed to properly merge the PR into master. ${CLEAN_UP_MSG}`,
  ERROR_phase5: `Failed to run the CI-checks or the CI-checks didn\'t pass. ${CLEAN_UP_MSG}`,
  ERROR_phase6: `Failed to clean up or push the changes to origin. ${CLEAN_UP_MSG}`,
  ERROR_unexpected: `Unexpected error! ${CLEAN_UP_MSG}`
};

// Imports
let chalk = require('chalk');
let childProcess = require('child_process');
let fs = require('fs');
let readline = require('readline');

// Variables - Private
let execAsPromised = asPromised(childProcess.exec, childProcess);
let spawnAsPromised = asPromised(spawnWrapper);
let writeFileAsPromised = asPromised(fs.writeFile, fs);
let unlinkAsPromised = asPromised(fs.unlink, fs);

//Run
_main(process.argv.slice(2));

// Functions - Definitions
function _main(args) {
  let repo = null;
  let prNo = null;
  let pushed = false;

  getAndValidateInput(args).
    then(input => {
      repo = input.repo;
      prNo = input.prNo;
    }).
    then(() => displayHeader(repo, prNo)).
    then(() => phase1(prNo)).
    then(() => phase2(repo, prNo)).
    then(() => phase3(repo, prNo)).
    then(() => phase4()).
    then(() => phase5()).
    then(() => phase6(prNo)).
    then(pd => pushed = pd).
    then(() => theEnd(pushed)).
    catch(exitWithError('ERROR_unexpected'));
}

// -------------------------------------------------------------------------------------------------

// INPUT - VALIDATION
function getAndValidateInput(args) {
  let repo = process.env.NGPR_REPO || 'angular.js';
  let prNo = args[0];

  if (!prNo) exitWithError('ERROR_missingPrNo')();

  return Promise.resolve({repo, prNo});
}

// DISCLAIMER
function displayHeader(repo, prNo) {
  console.log(chalk.yellow(
    '\n' +
    ':::::::::::::::::::::::::::::::::::::::::::::\n' +
    '::  WARNING:                               ::\n' +
    '::    This is still an experimental tool.  ::\n' +
    '::    Use with caution and your own risk!  ::\n' +
    ':::::::::::::::::::::::::::::::::::::::::::::\n'));

  console.log(chalk.blue.bold(`MERGING PR #${prNo} (to '${repo}'):`));
}


// PHASE 1 (Verify CLA signature)
function phase1(prNo) {
  let question = chalk.bgYellow.black('Failed to verify the CLA signature. Proceed anyway?') +
                 chalk.red(' (NOT RECOMMENDED)');

  return phase(1, 'Verifying CLA signature', () =>
    spawnAsPromised(`${getExecutable('ng-cla-check')} ${prNo}`).
      catch(() => askYesOrNoQuestion(question)));
}

// PHASE 2 (Fetch PR as local branch)
function phase2(repo, prNo) {
  return phase(2, 'Fetching PR as local branch', () =>
    spawnAsPromised([
      'git checkout master',
      'git pull --rebase origin master',
      `git checkout -b pr-${prNo}`,
      `curl -L https://github.com/angular/${repo}/pull/${prNo}.patch | git am -3`
    ]));
}

// PHASE 3 (Merge into master)
function phase3(repo, prNo) {
  let cmds = [
    'git checkout master',
    `git rebase pr-${prNo}`
  ];

  return phase(3, 'Merging into master', () =>
    getCommitCount().
      then(count => { if (count > 1) cmds.push(`git rebase -i HEAD~${count}`); }).
      then(() => spawnAsPromised(cmds)).
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
        let finallyCb = () => unlinkAsPromised(tempFile);

        return writeFileAsPromised(tempFile, newMsg).
          then(() => spawnAsPromised(`git commit --amend --file=${tempFile}`)).
          then(finallyCb, finallyCb);
      });
  }
}

// PHASE 4 (Inspect changes)
function phase4() {
  return phase(4, 'Inspecting changes', () =>
    Promise.resolve().
      then(() => console.log(chalk.yellow.bold('    GIT diff:\n'))).
      then(() => waitAsPromised(500)).
      then(() => spawnAsPromised('git diff origin/master')).
      then(() => console.log(chalk.yellow.bold('\n    GIT log:\n'))).
      then(() => waitAsPromised(500)).
      then(() => spawnAsPromised('git log').
        // `git log` has an exit code !== 0 if paged
        catch(noop)));
}

// PHASE 5 (Run the CI-checks)
function phase5() {
  let question = chalk.bgYellow.black('Do you want to run the CI-checks now?') +
                 chalk.green(' (RECOMMENDED)');

  return phase(5, 'Running the CI-checks', () =>
    askYesOrNoQuestion(question, true).
      then(() => {
        console.log('    Initializing the CI-checks...\n');
        return spawnAsPromised(`${getExecutable('grunt')} ci-checks`);
      }, noop));
}

// PHASE 6 (Clean up and Push to origin)
function phase6(prNo) {
  let question = chalk.bgRed.white.bold(' CAUTION ') +
                 chalk.bgYellow.black('Do you want to push the changes to origin/master?');

  return phase(6, 'Cleaning up and Pushing to origin', () =>
    spawnAsPromised(`git branch -D pr-${prNo}`).
      then(() => askYesOrNoQuestion(question).
        then(() => spawnAsPromised('git push origin master').then(() => true),
             () => false)));
}


// THE END
function theEnd(changesPushed) {
  console.log(chalk.green.bold('\n  OPERATION COMPLETED SUCCESSFULLY!'));
  if (!changesPushed) {
    console.log(chalk.yellow.bold('  (Don\'t forget to manually push the changes.)'));
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

    rl.question(`${question}`, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

function askYesOrNoQuestion(question, defaultToYes) {
  return new Promise((resolve, reject) => {
    let optStyle = chalk.bgBlack.gray;
    let defStyle = chalk.white.bold;
    let answerOptions = optStyle(defaultToYes ? `[${defStyle('Y')}/n]` : `[y/${defStyle('N')}]`);

    askQuestion(`\n${question} ${answerOptions}: ` + chalk.bgWhite('')).then(answer => {
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
    console.error(chalk.red(`\n  ERROR: ${errMsg}\n\n  ${chalk.bold('OPERATION ABORTED!')}`));

    process.exit(1);
  };
}

function getExecutable(name) {
  let suffix = (process.platform === 'win32') ? '.cmd' : '';

  return name + suffix;
}

function noop() {}

function phase(phaseNo, description, doWork) {
  console.log(chalk.cyan.bold(`\n\n  PHASE ${phaseNo} - ${description}...\n`));

  return doWork().
    then(output => {
      console.log(chalk.green('\n  ...done'));
      return output;
    }).
    catch(exitWithError(`ERROR_phase${phaseNo}`));
}

function spawnWrapper(andableCmds, cb) {
  var andableCmdSpecArr = (Array.isArray(andableCmds) ? andableCmds : [andableCmds]).
    map(parseAndableCmd);

  andableCmdSpecArr.
    reduce(
        (promise, pipableCmdSpecArr) => promise.then(() => pipeCmds(pipableCmdSpecArr)),
        Promise.resolve()).
    then(out => cb(null, out), err => cb(err));

  // Helpers
  function parseAndableCmd(andableCmd) {
    return andableCmd.
      split(' | ').
      map(parsePipableCmd);
  }

  function parsePipableCmd(pipableCmd) {
    let tokens = pipableCmd.
      split('"').
      reduce((arr, str, idx) => {
        let newTokens = (idx % 2) ? [`"${str}"`] : str.split(' ');
        let lastToken = arr[arr.length - 1];

        if (lastToken) arr[arr.length - 1] += newTokens.shift();

        return arr.concat(newTokens);
      }, []).
      filter(Boolean);

    return {
      executable: tokens.shift(),
      args: tokens
    };
  }

  function pipeCmds(pipableCmdSpecArr) {
    return new Promise((resolve, reject) =>
      pipableCmdSpecArr.reduce((prevProc, cmdSpec, idx, arr) => {
        let isLast = idx === arr.length - 1;
        let options = {stdio: [
          prevProc ? prevProc.stdout : 'inherit',
          !isLast ? 'pipe' : 'inherit',
          'inherit'
        ]};

        return childProcess.spawn(cmdSpec.executable, cmdSpec.args, options).
          on('error', reject).
          on('exit', (code, signal) => {
            if (code !== 0) return reject(code || signal);
            if (isLast) return resolve();
          });
      }, null));
  }
}

function waitAsPromised(period) {
  return new Promise(resolve => setTimeout(resolve, period));
}
