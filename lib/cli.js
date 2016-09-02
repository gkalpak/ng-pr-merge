'use strict';

// Imports
let chalk = require('chalk');
let minimist = require('minimist');

// Imports - Local
let CleanUper = require('./clean-uper');
let Config = require('./config');
let GitUtils = require('./git-utils');
let Merger = require('./merger');
let Utils = require('./utils');

// Classes
class Cli {
  // Constructor
  constructor() {
    this._cleanUper = new CleanUper();
    this._config = new Config();
    this._utils = new Utils(this._cleanUper, this._config.messages);
  }

  // Methods - Protected
  _displayHeader(repo, branch, prNo) {
    this._displayWarning();
    console.log(chalk.blue.bold(`MERGING PR #${prNo} (to '${repo}#${branch}'):`));
  }

  _displayInstructions(input) {
    let phases = this._config.messages.phases;

    let header = `\nInstructions for merging PR #${input.prNo} to '${input.repo}#${input.branch}':`;
    console.log(chalk.blue.bold(header));

    input.tempBranch = Merger.getTempBranch(input.prNo);
    input.prUrl = Merger.getPrUrl(input.repo, input.prNo);

    Object.keys(phases).forEach(phaseId => {
      let phase = phases[phaseId];
      let description = phase.description;
      let instructions = phase.instructions.map(task => this._utils.interpolate(task, input));

      if (!instructions.length) return;

      console.log(chalk.cyan.bold(`\n\n  PHASE ${phaseId} - ${description}\n`));
      instructions.forEach(task => {
        task = task.replace(/`([^`]+)`/g, `${chalk.bgBlack.green('$1')}`);
        console.log(`    - ${task}`);
      });
    });
  }

  _displayUsage() {
    let usageMessage = this._config.messages.usage;

    let lines = usageMessage.split('\n');
    let first = lines.shift();
    let rest = lines.join('\n');

    this._displayWarning();
    console.log(chalk.bgBlack(`${chalk.bold(first)}\n${chalk.gray(rest)}`));
  }

  _displayWarning() {
    console.log(chalk.yellow(
        '\n' +
        ':::::::::::::::::::::::::::::::::::::::::::::\n' +
        '::  WARNING:                               ::\n' +
        '::    This is still an experimental tool.  ::\n' +
        '::    Use at your own risk!                ::\n' +
        ':::::::::::::::::::::::::::::::::::::::::::::\n'));
  }

  _getAndValidateInput(args) {
    let defaults = this._config.defaults;

    args = this._utils.removeSurroundingQuotes(minimist(args));
    if (args.usage) return {usage: true};

    let instructions = !!args.instructions;
    let repo = args.repo || defaults.repo;
    let branch = args.branch || defaults.branch;
    let prNo = args._[0];

    if (repo && (repo.indexOf('/') === -1)) {
      this._utils.exitWithError('ERROR_invalidRepo', true)();
    } else if (!prNo) {
      this._utils.exitWithError('ERROR_missingPrNo', true)();
    }

    return {instructions, repo, branch, prNo};
  }

  _theEnd(changesPushed) {
    console.log(chalk.green.bold('\n  OPERATION COMPLETED SUCCESSFULLY!'));
    if (!changesPushed) {
      console.log(chalk.yellow.bold('  (Don\'t forget to manually push the changes.)'));
    }
  }

  // Methods - Public
  run(args) {
    let input = this._getAndValidateInput(args);

    if (input.usage) {
      this._displayUsage();
      process.exit(0);
    } else if (input.instructions) {
      this._displayInstructions(input);
      process.exit(0);
    }

    this._gUtils = new GitUtils(this._cleanUper, this._utils);
    this._merger = new Merger(this._cleanUper, this._utils, this._gUtils, input);

    this._displayHeader(input.repo, input.branch, input.prNo);

    return this._merger.
      merge().
      then(changesPushed => this._theEnd(changesPushed)).
      catch(this._utils.exitWithError('ERROR_unexpected'));
  }
}

// Exports
module.exports = Cli;
