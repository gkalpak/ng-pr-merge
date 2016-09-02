'use strict';

// Imports - Local
let Config = require('../../lib/config');

// Tests
describe('Config', () => {
  let config;

  beforeEach(() => {
    config = new Config();
  });

  describe('#defaults', () => {
    let defaults;

    beforeEach(() => {
      defaults = config.defaults;
    });

    it('should be an object', () => {
      expect(defaults).toBeDefined();
      expect(defaults).toEqual(jasmine.any(Object));
    });

    it('should have a `repo` property (string)', () => {
      expect(defaults.repo).toBeDefined();
      expect(defaults.repo).toEqual(jasmine.any(String));
    });

    it('should include the user in `repo`', () => {
      let tokens = defaults.repo.split('/');
      let userName = tokens[0];
      let repoName = tokens[1];

      expect(userName).toBeDefined();
      expect(repoName).toBeDefined();
      expect(tokens.length).toBe(2);
    });

    it('should have a `branch` property (string)', () => {
      expect(defaults.branch).toBeDefined();
      expect(defaults.branch).toEqual(jasmine.any(String));
    });
  });

  describe('#messages', () => {
    let phaseNames = ['1', '2', '3', '4', '5', '6', 'X'];
    let messages;

    beforeEach(() => {
      messages = config.messages;
    });

    it('should be an object', () => {
      expect(messages).toBeDefined();
      expect(messages).toEqual(jasmine.any(Object));
    });

    describe('#usage', () => {
      let usage;

      beforeEach(() => {
        usage = messages.usage;
      });

      it('should be a string', () => {
        expect(usage).toBeDefined();
        expect(usage).toEqual(jasmine.any(String));
      });

      it('should mention the default values', () => {
        expect(usage.indexOf(config.defaults.repo)).toBeGreaterThan(-1);
        expect(usage.indexOf(config.defaults.branch)).toBeGreaterThan(-1);
      });
    });

    describe('#offerToCleanUp', () => {
      let offerToCleanUp;

      beforeEach(() => {
        offerToCleanUp = messages.offerToCleanUp;
      });

      it('should be a string', () => {
        expect(offerToCleanUp).toBeDefined();
        expect(offerToCleanUp).toEqual(jasmine.any(String));
      });

      it('should not promise too much', () => {
        expect(offerToCleanUp.indexOf('try')).toBeGreaterThan(-1);
      });
    });

    describe('#phases', () => {
      let phases;

      beforeEach(() => {
        phases = messages.phases;
      });

      it('should be an object', () => {
        expect(phases).toBeDefined();
        expect(phases).toEqual(jasmine.any(Object));
      });

      phaseNames.forEach(name => {
        describe(` - Phase ${name}`, () => {
          let phase;

          beforeEach(() => {
            phase = phases[name];
          });

          it('should be an object', () => {
            expect(phase).toBeDefined();
            expect(phase).toEqual(jasmine.any(Object));
          });

          it('should have a `description` property (string)', () => {
            let description = phase.description;

            expect(description).toBeDefined();
            expect(description).toEqual(jasmine.any(String));
          });

          it('should have an `instructions` property (string[])', () => {
            let instructions = phase.instructions;

            expect(instructions).toBeDefined();
            expect(instructions).toEqual(jasmine.any(Array));

            instructions.forEach(instruction => {
              expect(instruction).toEqual(jasmine.any(String));
            });
          });
        });
      });
    });

    describe('#errors', () => {
      let keyPrefix = 'ERROR_';
      let errors;

      beforeEach(() => {
        errors = messages.errors;
      });

      it('should be an object', () => {
        expect(errors).toBeDefined();
        expect(errors).toEqual(jasmine.any(Object));
      });

      it(`should have all its keys prefixed with \`${keyPrefix}\``, () => {
        Object.keys(errors).forEach(key => {
          expect(key.indexOf(keyPrefix)).toBe(0);
        });
      });

      it('should have an error message (string) for each phase', () => {
        phaseNames.forEach(name => {
          let key = `${keyPrefix}phase${name}`;

          expect(errors[key]).toBeDefined();
          expect(errors[key]).toEqual(jasmine.any(String));
        });
      });

      ['invalidRepo', 'missingPrNo', 'unexpected'].forEach(errorId => {
        it(`should include an error message (string) for \`${errorId}\``, () => {
          let key = `${keyPrefix}${errorId}`;

          expect(errors[key]).toBeDefined();
          expect(errors[key]).toEqual(jasmine.any(String));
        });
      });
    });
  });

  it('should be possible to create independent instances', () => {
    let originalRepo = config.defaults.repo;
    let config2 = new Config();

    config.defaults.repo = 'foo';

    expect(config).not.toBe(config2);
    expect(config.defaults.repo).toBe('foo');
    expect(config2.defaults.repo).toBe(originalRepo);
  });
});
