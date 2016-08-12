#!/usr/bin/env node
'use strict';

// Imports
let chalk = require('chalk');
let minimist = require('minimist');

// Imports - Local
let CleanUper = require('./lib/clean-uper');
let Config = require('./lib/config');
let GitUtils = require('./lib/git-utils');
let Merger = require('./lib/merger');
let Utils = require('./lib/utils');

//Run
_main(process.argv.slice(2));

// Functions - Definitions
function _main(args) {
  let config = new Config();
  let cleanUper = new CleanUper();
  let utils = new Utils(cleanUper, config.messages);
  let input = getAndValidateInput(args, config.defaults, utils);

  if (input.usage) return displayUsage(config.messages);

  let gUtils = new GitUtils(cleanUper, utils);
  let merger = new Merger(cleanUper, utils, gUtils, input);

  displayHeader(input.repo, input.prNo, input.branch);
  merger.merge().then(theEnd).catch(utils.exitWithError('ERROR_unexpected'));
}

function displayHeader(repo, prNo, branch) {
  displayWarning();
  console.log(chalk.blue.bold(`MERGING PR #${prNo} (to '${repo}#${branch}'):`));
}

function displayUsage(messages) {
  let lines = messages.usage.split('\n');
  let first = lines.shift();
  let rest = lines.join('\n');

  displayWarning();
  console.log(chalk.bgBlack(`${chalk.bold(first)}\n${chalk.gray(rest)}`));
}

function displayWarning() {
  console.log(chalk.yellow(
      '\n' +
      ':::::::::::::::::::::::::::::::::::::::::::::\n' +
      '::  WARNING:                               ::\n' +
      '::    This is still an experimental tool.  ::\n' +
      '::    Use at your own risk!                ::\n' +
      ':::::::::::::::::::::::::::::::::::::::::::::\n'));
}

function getAndValidateInput(args, defaults, utils) {
  args = utils.removeSurroundingQuotes(minimist(args));

  if (args.usage) return {usage: true};

  let repo = args.repo || defaults.repo;
  let prNo = args._[0];
  let branch = args._[1] || defaults.branch;

  if (repo.indexOf('/') === -1) {
    utils.exitWithError('ERROR_invalidRepo', true)();
  }
  if (!prNo) {
    utils.exitWithError('ERROR_missingPrNo', true)();
  }

  return {repo, prNo, branch};
}

function theEnd(changesPushed) {
  console.log(chalk.green.bold('\n  OPERATION COMPLETED SUCCESSFULLY!'));
  if (!changesPushed) {
    console.log(chalk.yellow.bold('  (Don\'t forget to manually push the changes.)'));
  }
}
