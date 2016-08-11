#!/usr/bin/env node
'use strict';

// Imports
let chalk = require('chalk');
let minimist = require('minimist');

// Imports - Local
let Config = require('./lib/config');
let pkg = require('./package.json');
let GitUtils = require('./lib/git-utils');
let Merger = require('./lib/merger');
let Utils = require('./lib/utils');

//Run
_main(process.argv.slice(2));

// Functions - Definitions
function _main(args) {
  let config = new Config(pkg);
  let utils = new Utils(config.errorMessages);
  let gUtils = new GitUtils(utils);

  let input = getAndValidateInput(args, config.defaults, utils);
  let merger = new Merger(utils, gUtils, input);

  displayHeader(input.repo, input.prNo, input.branch);
  merger.merge().then(theEnd).catch(utils.exitWithError('ERROR_unexpected'));
}

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

function getAndValidateInput(args, defaults, utils) {
  args = minimist(args);

  let repo = args.repo || defaults.repo;
  let prNo = args._[0] || utils.exitWithError('ERROR_missingPrNo')();
  let branch = args._[1] || defaults.branch;

  return {repo, prNo, branch};
}

function theEnd(changesPushed) {
  console.log(chalk.green.bold('\n  OPERATION COMPLETED SUCCESSFULLY!'));
  if (!changesPushed) {
    console.log(chalk.yellow.bold('  (Don\'t forget to manually push the changes.)'));
  }
}
