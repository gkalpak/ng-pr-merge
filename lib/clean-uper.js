'use strict';

// Classes
class CleanUper {
  // Constructor
  constructor() {
    this._tasks = [];
  }

  // Methods - Public
  cleanUp() {
    let task = this._tasks.pop();

    return !task ? Promise.resolve() : Promise.resolve(task()).then(() => this.cleanUp());
  }

  hasTasks() {
    return !!this._tasks.length;
  }

  register(tasks) {
    if (!Array.isArray(tasks)) tasks = [tasks];

    tasks.forEach(task => this._tasks.push(task));
  }

  unregister(tasks) {
    if (!Array.isArray(tasks)) tasks = [tasks];

    tasks.forEach(task => {
      let idx = this._tasks.lastIndexOf(task);
      if (idx !== -1) this._tasks.splice(idx, 1);
    });
  }

  withTask(task, fn) {
    this.register(task);

    return fn().then(val => {
      this.unregister(task);
      return val;
    });
  }
}

// Exports
module.exports = CleanUper;
