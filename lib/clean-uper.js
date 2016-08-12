'use strict';

// Imports
let chalk = require('chalk');

// Classes
class CleanUper {
  // Constructor
  constructor() {
    this._registeredTaskIds = [];
    this._registeredTasks = [];
    this._scheduledTasks = [];
  }

  // Methods - Private
  _getTask(taskId) {
    let idx = this._registeredTaskIds.indexOf(taskId);
    if (idx === -1) throw Error(`Unregistered task: ${taskId}`);

    return this._registeredTasks[idx];
  }

  // Methods - Public
  cleanUp(listOnly) {
    let task = this._scheduledTasks.pop();
    let initialPromise = Promise.resolve();

    return !task ? initialPromise : initialPromise.
      then(() => console.log(chalk.cyan(` - Clean-up task: ${chalk.blue(task.description)}`))).
      then(() => listOnly || task.cb()).
      then(() => this.cleanUp(listOnly));
  }

  hasTasks() {
    return !!this._scheduledTasks.length;
  }

  registerTask(description, cb) {
    let taskId = Object.create(null);

    this._registeredTaskIds.push(taskId);
    this._registeredTasks.push({description, cb});

    return taskId;
  }

  schedule(taskId) {
    let task = this._getTask(taskId);
    this._scheduledTasks.push(task);
  }

  unschedule(taskId) {
    let task = this._getTask(taskId);
    let idx = this._scheduledTasks.lastIndexOf(task);
    if (idx !== -1) this._scheduledTasks.splice(idx, 1);
  }

  withTask(taskId, fn) {
    this.schedule(taskId);

    return Promise.resolve().
      then(() => fn()).
      then(val => {
        this.unschedule(taskId);
        return val;
      });
  }
}

// Exports
module.exports = CleanUper;