'use strict';

// Imports
let util = require('util');

// Classes
class Phase {
  // Constructor
  constructor(id, description, instructions) {
    this.id = id;
    this.description = description;
    this.instructions = instructions || [];

    this._validateFields();
  }

  // Methods - Protected
  _missingOrInvalidField(field) {
    throw new Error(`Missing or invalid field \`${field}\` on: ${this}`);
  }

  _validateFields() {
    if (typeof this.id !== 'string') {
      this._missingOrInvalidField('id');
    }

    if (typeof this.description !== 'string') {
      this._missingOrInvalidField('description');
    }

    if (!Array.isArray(this.instructions)) {
      this._missingOrInvalidField('instructions');
    }

    this.instructions.forEach(instruction => {
      if (typeof instruction !== 'string') {
        this._missingOrInvalidField('instruction');
      }
    });
  }

  // Methods - Public
  toString() {
    return util.format(this);
  }
}

// Exports
module.exports = Phase;
