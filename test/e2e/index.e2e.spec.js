'use strict';

// Imports
let childProcess = require('child_process');
let ClaChecker = require('@gkalpak/ng-cla-check');

// Imports - Local
let Config = require('../../lib/config');
let Merger = require('../../lib/merger');

// Tests
describe('index', () => {
  let spawn = childProcess.spawn;
  let indexScript = require.resolve('../../index');
  let config;

  beforeEach(() => {
    config = new Config();
  });

  describe('--version', () => {
    it('should display the correct version info', done => {
      runWith(['--version']).
        then(response => {
          expect(response.code).toBe(0);
          expect(response.stderr).toBe('');
          expect(response.stdout).toContain('@gkalpak/ng-pr-merge');
          expect(response.stdout).toContain(config.versionInfo.version);
        }).
        then(done);
    });
  });

  describe('--usage', () => {
    it('should display the usage instructions', done => {
      runWith(['--usage']).
        then(response => {
          expect(response.code).toBe(0);
          expect(response.stderr).toBe('');
          expect(response.stdout).toContain(config.messages.usage);
        }).
        then(done);
    });

    it('should not display "manually push the changes"', done => {
      runWith(['--usage']).
        then(response => expect(response.stdout).not.toContain('manually push the changes')).
        then(done);
    });
  });

  describe('--instructions', () => {
    it('should display the commands that need to be run', done => {
      runWith(['12345', '--instructions']).
        then(response => {
          let phases = Merger.getPhases();

          expect(response.code).toBe(0);
          expect(response.stderr).toBe('');
          expect(response.stdout).toContain('Instructions');
          expect(response.stdout).toContain('12345');

          phases.forEach(phase => {
            if (phase.instructions.length) {
              expect(response.stdout).toContain(`PHASE ${phase.id}`);
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
          expect(response.stderr).toBe('');
          expect(response.stdout).toContain(config.defaults.branch);
          expect(response.stdout).toContain(config.defaults.repo);
        }).
        then(done);
    });

    it('should display instructions specific to custom `repo`/`branch` (if specified)', done => {
      runWith(['12345', '--branch="foo-bar"', '--repo=baz/qux', '--instructions']).
        then(response => {
          expect(response.code).toBe(0);
          expect(response.stderr).toBe('');
          expect(response.stdout).not.toContain(config.defaults.branch);
          expect(response.stdout).not.toContain(config.defaults.repo);
          expect(response.stdout).toContain('foo-bar');
          expect(response.stdout).toContain('baz/qux');
        }).
        then(done);
    });

    it('should error if the repo is invalid', done => {
      runWith(['12345', '--repo=baz\\qux', '--instructions']).
        then(response => {
          expect(response.code).toBe(1);
          expect(trim(response.stdout)).toBe('');
          expect(response.stderr).toContain('ERROR: Invalid repo');
          expect(response.stderr).toContain('Make sure to include the username');
          expect(response.stderr).toContain(config.defaults.repo);
        }).
        then(done);
    });

    it('should error if the branch is invalid', done => {
      let promises = ['--branch', '--branch='].map(branchArg => {
        runWith(['12345', branchArg, '--instructions']).
          then(response => {
            expect(response.code).toBe(1);
            expect(trim(response.stdout)).toBe('');
            expect(response.stderr).toContain('ERROR: The target branch cannot be empty');
          });
      });

      Promise.
        all(promises).
        then(done);
    });

    it('should error if no PR is specified (and display the usage instructions)', done => {
      runWith(['--instructions']).
        then(response => {
          expect(response.code).toBe(1);
          expect(trim(response.stdout)).toBe('');
          expect(response.stderr).toContain('ERROR: No PR specified');
          expect(response.stderr).toContain(config.messages.usage);
        }).
        then(done);
    });

    it('should display the name of the (auto-generated) temporary branch', done => {
      let tempBranch = Merger.getTempBranch(12345);

      runWith(['12345', '--instructions']).
        then(response => {
          expect(response.code).toBe(0);
          expect(response.stderr).toBe('');
          expect(response.stdout).toContain(tempBranch);
        }).
        then(done);
    });

    it('should display the (auto-generated) URL for fetching the PR', done => {
      let prUrl = Merger.getPrUrl(12345, 'foo/bar');

      runWith(['12345', '--repo="foo/bar"', '--instructions']).
        then(response => {
          expect(response.code).toBe(0);
          expect(response.stderr).toBe('');
          expect(response.stdout).toContain(prUrl);
        }).
        then(done);
    });

    it('should not display "manually push the changes"', done => {
      runWith(['12345', '--instructions']).
        then(response => expect(response.stdout).not.toContain('manually push the changes')).
        then(done);
    });
  });

  describe('--no-usage --no-instructions', () => {
    describe('- Incorrect usage', () => {
      it('should error if the repo is invalid', done => {
        runWith(['12345', '--repo=baz\\qux']).
          then(response => {
            expect(response.code).toBe(1);
            expect(trim(response.stdout)).toBe('');
            expect(response.stderr).toContain('ERROR: Invalid repo');
            expect(response.stderr).toContain('Make sure to include the username');
            expect(response.stderr).toContain(config.defaults.repo);
          }).
          then(done);
      });

      it('should error if the branch is invalid', done => {
        let promises = ['--branch', '--branch='].map(branchArg => {
          return runWith(['12345', branchArg]).
            then(response => {
              expect(response.code).toBe(1);
              expect(trim(response.stdout)).toBe('');
              expect(response.stderr).toContain('ERROR: The target branch cannot be empty');
            });
        });

        Promise.
          all(promises).
          then(done);
      });

      it('should error if no PR is specified (and display the usage instructions)', done => {
        runWith([]).
          then(response => {
            expect(response.code).toBe(1);
            expect(trim(response.stdout)).toBe('');
            expect(response.stderr).toContain('ERROR: No PR specified');
            expect(response.stderr).toContain(config.messages.usage);
          }).
          then(done);
      });
    });

    describe('- Correct usage', () => {
      // Only run the tests if a GitHub access-token is available
      if (!process.env.hasOwnProperty(ClaChecker.getGhTokenVar())) {
        console.warn('\n  No GitHub access-token available. ' +
                     'Skipping `index --no-usage --no-instructions` tests...\n');
        return;
      }

      it('needs tests (but adding them is too complicated and probably not going to happen)');
    });
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

  function trim(str) {
    return str.replace(/\u001b\[0m$/, '').trim();
  }
});
