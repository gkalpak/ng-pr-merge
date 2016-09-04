'use strict';

// Imports
let childProcess = require('child_process');
let ClaChecker = require('@gkalpak/ng-cla-check');

// Imports - Local
let Config = require('../../lib/config');

// Tests
describe('index', () => {
  let spawn = childProcess.spawn;
  let indexScript = require.resolve('../../index');
  let config;

  beforeEach(() => {
    config = new Config();
  });

  describe('--usage', () => {
    it('should display the usage instructions', done => {
      runWith(['--usage']).
        then(response => {
          expect(response.code).toBe(0);
          expect(response.stdout).toContain(config.messages.usage);
        }).
        then(done);
    });
  });

  describe('--instructions', () => {
    it('should display the commands that need to be run', done => {
      runWith(['12345', '--instructions']).
        then(response => {
          let phases = config.messages.phases;

          expect(response.code).toBe(0);
          expect(response.stdout).toContain('Instructions');
          expect(response.stdout).toContain('12345');

          Object.keys(phases).forEach(phaseId => {
            let phase = phases[phaseId];

            if (phase.instructions.length) {
              expect(response.stdout).toContain(`PHASE ${phaseId}`);
              expect(response.stdout).toContain(phase.description);
            }
          });
        }).
        then(done);
    });

    it('should fall back to the default `repo`/`branch` (if none specified)', done => {
      runWith(['12345', '--instructions']).
        then(response => {
          expect(response.code).toBe(0);
          expect(response.stdout).toContain(config.defaults.branch);
          expect(response.stdout).toContain(config.defaults.repo);
        }).
        then(done);
    });

    it('should display instructions specific to custom `repo`/`branch` (if specified)', done => {
      runWith(['12345', '--branch=foo-bar', '--repo=baz/qux', '--instructions']).
        then(response => {
          expect(response.code).toBe(0);
          expect(response.stdout).not.toContain(config.defaults.branch);
          expect(response.stdout).not.toContain(config.defaults.repo);
          expect(response.stdout).toContain('foo-bar');
          expect(response.stdout).toContain('baz/qux');
        }).
        then(done);
    });

    it('should error if no PR is specified (and display the usage instructions)', done => {
      runWith(['--instructions']).
        then(response => {
          expect(response.code).not.toBe(0);
          expect(response.stderr).toContain('ERROR: No PR specified');
          expect(response.stderr).toContain(config.messages.usage);
        }).
        then(done);
    });
  });

  describe('--no-usage --no-instructions', () => {
    // Only run the tests if a GitHub access-token is available
    if (!process.env.hasOwnProperty(ClaChecker.GH_TOKEN_VAR)) {
      console.warn('\n  No GitHub access-token available. ' +
                   'Skipping `index --no-usage --no-instructions` tests...\n');
      return;
    }

    it('needs tests');
  });

  // Helpers
  function runWith(args) {
    return new Promise(resolve => {
      args.unshift(indexScript);

      let stdout = '';
      let stderr = '';
      let cb = (code, signal) => resolve({code, signal, stdout, stderr});

      let proc = spawn(process.execPath, args).on('exit', cb);
      proc.stdout.on('data', d => stdout += d);
      proc.stderr.on('data', d => stderr += d);
    });
  }
});
