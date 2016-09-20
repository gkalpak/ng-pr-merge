'use strict';

// Imports
let chalk = require('chalk');
let ngMaintainUtils = require('@gkalpak/ng-maintain-utils');

let AbstractCli = ngMaintainUtils.AbstractCli;
let GitUtils = ngMaintainUtils.GitUtils;

// Imports - Local
let Config = require('./config');
let Merger = require('./merger');

// Classes
class Cli extends AbstractCli {
  // Constructor
  constructor() {
    super(new Config());

    this._gitUtils = new GitUtils(this._cleanUper, this._utils);
  }

  // Methods - Protected
  _displayInstructions(phases, input) {
    let extendedInput = Object.assign({}, input);

    extendedInput.prUrl = Merger.getPrUrl(input.prNo, input.repo);
    extendedInput.tempBranch = Merger.getTempBranch(input.prNo);

    super._displayInstructions(phases, extendedInput);
  }

  _theEnd(changesPushed) {
    super._theEnd();

    if (!changesPushed) {
      console.log(chalk.yellow.bold('  (Don\'t forget to manually push the changes.)'));
    }

    return changesPushed;
  }

  // Methods - Public
  getPhases() {
    return Merger.getPhases();
  }

  run(rawArgs) {
    let doWork = input => Promise.resolve().
      then(() => new Merger(this._cleanUper, this._utils, this.uiUtils, this.gitUtils, input)).
      then(merger => this._merger = merger).
      then(merger => merger.merge());

    return super.
      run(rawArgs, doWork).
      catch(err => err ?
          this._uiUtils.reportAndRejectFnGen('ERROR_unexpected')(err) :
          Promise.reject());
  }
}

// Exports
module.exports = Cli;
