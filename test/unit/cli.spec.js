'use strict';

// Imports
let chalk = require('chalk');

// Imports - Local
let CleanUper = require('../../lib/clean-uper');
let Cli = require('../../lib/cli');
let Config = require('../../lib/config');
let Merger = require('../../lib/merger');
let Phase = require('../../lib/phase');
let Utils = require('../../lib/utils');

// Tests
describe('Cli', () => {
  let cli;

  beforeEach(() => {
    cli = new Cli();

    spyOn(console, 'log');
  });

  describe('#constructor()', () => {
    it('should create a `CleanUper` instance', () => {
      expect(cli._cleanUper).toEqual(jasmine.any(CleanUper));
    });

    it('should create a `Config` instance', () => {
      expect(cli._config).toEqual(jasmine.any(Config));
    });

    it('should create a `CleanUper` instance', () => {
      expect(cli._utils).toEqual(jasmine.any(Utils));
    });
  });

  describe('#_displayHeader()', () => {
    beforeEach(() => {
      spyOn(cli, '_displayWarning');
    });

    it('should display the "experimental tool" warning', () => {
      expect(cli._displayWarning).not.toHaveBeenCalled();

      cli._displayHeader();

      expect(cli._displayWarning).toHaveBeenCalled();
    });

    it('should display the `repo`, `branch` and `prNo` operated on', () => {
      cli._displayHeader('foo', 'bar', 'baz');

      expect(console.log.calls.argsFor(0)[0]).toContain('foo');
      expect(console.log.calls.argsFor(0)[0]).toContain('bar');
      expect(console.log.calls.argsFor(0)[0]).toContain('baz');
    });
  });

  describe('#_displayInstructions()', () => {
    let mockPhases;

    beforeEach(() => {
      mockPhases = [];
      spyOn(Merger, 'getPhases').and.callFake(() => mockPhases);
    });

    it('should mention "instructions"', () => {
      cli._displayInstructions({});

      expect(console.log.calls.argsFor(0)[0].toLowerCase()).toContain('instructions');
    });

    it('should display the `repo`, `branch` and `prNo` operated on', () => {
      cli._displayInstructions({repo: 'foo', branch: 'bar', prNo: 'baz'});

      expect(console.log.calls.argsFor(0)[0]).toContain('foo');
      expect(console.log.calls.argsFor(0)[0]).toContain('bar');
      expect(console.log.calls.argsFor(0)[0]).toContain('baz');
    });

    it('should display the ID and description of each phase', () => {
      mockPhases = [
        new Phase('foo', 'bar', ['instruction 1', 'instruction 2']),
        new Phase('baz', 'qux', ['instruction 3', 'instruction 4'])
      ];

      cli._displayInstructions({});

      expect(console.log.calls.argsFor(1)[0]).toContain('foo');
      expect(console.log.calls.argsFor(1)[0]).toContain('bar');
      expect(console.log.calls.argsFor(4)[0]).toContain('baz');
      expect(console.log.calls.argsFor(4)[0]).toContain('qux');
    });

    it('should not display anything about phases with no instructions', () => {
      mockPhases = [
        new Phase('foo', 'bar', []),
        new Phase('baz', 'qux', [])
      ];

      cli._displayInstructions({});

      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it('should display the instructions of each phase', () => {
      mockPhases = [
        new Phase('foo', 'bar', ['instruction 1', 'instruction 2']),
        new Phase('baz', 'qux', ['instruction 3', 'instruction 4'])
      ];

      cli._displayInstructions({});

      expect(console.log.calls.argsFor(2)[0]).toContain('instruction 1');
      expect(console.log.calls.argsFor(3)[0]).toContain('instruction 2');
      expect(console.log.calls.argsFor(5)[0]).toContain('instruction 3');
      expect(console.log.calls.argsFor(6)[0]).toContain('instruction 4');
    });

    it('should interpolate each instruction', () => {
      mockPhases = [
        new Phase('phase', '', ['foo: {{bar}}', '{{baz}}: qux'])
      ];

      cli._displayInstructions({bar: 'bar', baz: 'baz'});

      expect(console.log.calls.argsFor(2)[0]).toContain('foo: bar');
      expect(console.log.calls.argsFor(3)[0]).toContain('baz: qux');
    });

    it('should format `...` specially', () => {
      mockPhases = [
        new Phase('phase', '', ['foo `bar` baz `qux`'])
      ];

      cli._displayInstructions({});

      expect(console.log.calls.argsFor(2)[0]).not.toContain('`bar`');
      expect(console.log.calls.argsFor(2)[0]).not.toContain('`qux`');
      expect(console.log.calls.argsFor(2)[0]).toMatch(/\u001b\[\S+bar\u001b\[\S+/);
      expect(console.log.calls.argsFor(2)[0]).toMatch(/\u001b\[\S+qux\u001b\[\S+/);
    });
  });

  describe('#_displayUsage()', () => {
    let chalkEnabled;

    beforeEach(() => {
      chalkEnabled = chalk.enabled;
      chalk.enabled = false;

      spyOn(cli, '_displayWarning');
    });

    afterEach(() => {
      chalk.enabled = chalkEnabled;
    });

    it('should display the "experimental tool" warning', () => {
      expect(cli._displayWarning).not.toHaveBeenCalled();

      cli._displayUsage();

      expect(cli._displayWarning).toHaveBeenCalled();
    });

    it('should display the usage instructions', () => {
      cli._displayUsage();

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log.calls.argsFor(0)[0]).toContain(cli._config.messages.usage);
    });
  });

  describe('#_displayWarning()', () => {
    it('should display the "experimental tool" warning', () => {
      cli._displayWarning();

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log.calls.argsFor(0)[0]).toContain('WARNING');
    });
  });

  describe('#_getAndValidateInput()', () => {
    it('should stop parsing if `--usage` is detected', () => {
      let args = ['foo', 'bar', '--baz=qux', '--usage'];
      let input = cli._getAndValidateInput(args);

      expect(input).toEqual({usage: true});
    });

    it('should remove surrounding quotes from "named" arguments', () => {
      spyOn(cli._utils, 'removeSurroundingQuotes').and.callThrough();

      let args = ['"12345"', '--repo=\'foo/bar\'', '--branch="baz-qux"'];
      let input = cli._getAndValidateInput(args);

      expect(cli._utils.removeSurroundingQuotes).toHaveBeenCalled();
      expect(input).toEqual(jasmine.objectContaining({
        repo: 'foo/bar',
        branch: 'baz-qux',
        prNo: '"12345"'
      }));
    });

    it('should read the `instructions` argument', () => {
      let args;
      let input;

      args = ['12345'];
      input = cli._getAndValidateInput(args);

      expect(input.instructions).toBe(false);

      args = ['12345', '--no-instructions'];
      input = cli._getAndValidateInput(args);

      expect(input.instructions).toBe(false);

      args = ['12345', '--instructions'];
      input = cli._getAndValidateInput(args);

      expect(input.instructions).toBe(true);
    });

    it('should read the `repo` argument', () => {
      let args = ['12345', '--repo=foo/bar'];
      let input = cli._getAndValidateInput(args);

      expect(input.repo).toBe('foo/bar');
    });

    it('should fall back to the default `repo` if not specified', () => {
      let args = ['12345'];
      let input = cli._getAndValidateInput(args);

      expect(input.repo).toBeDefined();
      expect(input.repo).toBe(cli._config.defaults.repo);
    });

    it('should read the `branch` argument', () => {
      let args = ['12345', '--branch="foo-bar"'];
      let input = cli._getAndValidateInput(args);

      expect(input.branch).toBe('foo-bar');
    });

    it('should fall back to the default `branch` if not specified', () => {
      let args = ['12345'];
      let input = cli._getAndValidateInput(args);

      expect(input.branch).toBeDefined();
      expect(input.branch).toBe(cli._config.defaults.branch);
    });

    it('should read the `prNo` (first "unnamed" argument)', () => {
      let args;
      let input;

      args = ['12345'];
      input = cli._getAndValidateInput(args);

      expect(input.prNo).toBe(12345);

      args = ['12345', '--foo=bar'];
      input = cli._getAndValidateInput(args);

      expect(input.prNo).toBe(12345);

      args = ['--foo=bar', '12345'];
      input = cli._getAndValidateInput(args);

      expect(input.prNo).toBe(12345);

      args = ['--foo=bar', '--baz=qux', '12345'];
      input = cli._getAndValidateInput(args);

      expect(input.prNo).toBe(12345);

      args = ['12345', '67890'];
      input = cli._getAndValidateInput(args);

      expect(input.prNo).toBe(12345);
    });

    it('should error if a custom `repo` does not contain a username', () => {
      let errorCb = jasmine.createSpy('errorCb');
      spyOn(cli._utils, 'exitWithError').and.returnValue(errorCb);

      cli._getAndValidateInput(['12345']);
      expect(cli._utils.exitWithError).not.toHaveBeenCalled();
      expect(errorCb).not.toHaveBeenCalled();

      cli._getAndValidateInput(['12345', '--repo=foo/bar']);
      expect(cli._utils.exitWithError).not.toHaveBeenCalled();
      expect(errorCb).not.toHaveBeenCalled();

      cli._getAndValidateInput(['12345', '--repo=foo-bar']);
      expect(cli._utils.exitWithError).toHaveBeenCalledWith('ERROR_invalidRepo', true);
      expect(errorCb).toHaveBeenCalled();
    });

    it('should error if no PR is specified', () => {
      let errorCb = jasmine.createSpy('errorCb');
      spyOn(cli._utils, 'exitWithError').and.returnValue(errorCb);

      cli._getAndValidateInput(['12345', '--repo=foo/bar']);
      expect(cli._utils.exitWithError).not.toHaveBeenCalled();
      expect(errorCb).not.toHaveBeenCalled();

      cli._getAndValidateInput(['--repo=foo/bar']);
      expect(cli._utils.exitWithError).toHaveBeenCalledWith('ERROR_missingPrNo', true);
      expect(errorCb).toHaveBeenCalled();
    });
  });

  describe('#_theEnd()', () => {
    let chalkEnabled;

    beforeEach(() => {
      chalkEnabled = chalk.enabled;
      chalk.enabled = false;
    });

    afterEach(() => {
      chalk.enabled = chalkEnabled;
    });

    it('should always display "OPERATION COMPLETED SUCCESSFULLY"', () => {
      cli._theEnd();
      cli._theEnd(false);
      cli._theEnd(true);

      expect(console.log).toHaveBeenCalledTimes(5);
      expect(console.log.calls.argsFor(0)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(2)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
      expect(console.log.calls.argsFor(4)[0]).toContain('OPERATION COMPLETED SUCCESSFULLY');
    });

    it('should not display "manually push the changes" if changes have not been pushed', () => {
      cli._theEnd(true);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log.calls.argsFor(0)[0]).not.toContain('manually push the changes');
    });

    it('should display "manually push the changes" if changes have not been pushed', () => {
      cli._theEnd();
      cli._theEnd(false);

      expect(console.log).toHaveBeenCalledTimes(4);
      expect(console.log.calls.argsFor(1)[0]).toContain('manually push the changes');
      expect(console.log.calls.argsFor(3)[0]).toContain('manually push the changes');
    });
  });

  describe('#run()', () => {
    let mergeSpy;

    beforeEach(() => {
      spyOn(process, 'exit');

      mergeSpy = spyOn(Merger.prototype, 'merge');
      mergeSpy.and.returnValue(new Promise(() => {}));
    });

    it('should read and validate the input', () => {
      spyOn(cli, '_getAndValidateInput').and.returnValue({});

      let args = [];
      cli.run(args);

      expect(cli._getAndValidateInput).toHaveBeenCalledWith(args);
    });

    it('should display the header', () => {
      spyOn(cli, '_displayHeader');

      let args = ['12345', '--branch=foo-bar', '--repo=baz/qux'];
      cli.run(args);

      expect(cli._displayHeader).toHaveBeenCalledWith('baz/qux', 'foo-bar', 12345);
    });

    it('should create a Merger and call `merge()`', () => {
      let args = ['12345', '--branch=foo-bar', '--repo=baz/qux'];
      cli.run(args);

      expect(cli._merger).toEqual(jasmine.any(Merger));
      expect(cli._merger._input).toEqual(jasmine.objectContaining({
        repo: 'baz/qux',
        branch: 'foo-bar',
        prNo: 12345
      }));
      expect(mergeSpy).toHaveBeenCalled();
    });

    it('should return a promise', () => {
      let args = ['12345'];
      let promise = cli.run(args);

      expect(promise).toEqual(jasmine.any(Promise));
    });

    it('should call `_theEnd()` once the promise returned by Merger is resolved', done => {
      mergeSpy.and.returnValue(Promise.resolve('Test'));
      spyOn(cli, '_theEnd');

      let args = ['12345'];
      cli.run(args).then(() => {
        expect(cli._theEnd).toHaveBeenCalledWith('Test');

        done();
      });
    });

    it('should attach an error callback to the promise returned by Merger', done => {
      let errorCb = jasmine.createSpy('errorCb');

      mergeSpy.and.returnValue(Promise.reject('Test'));
      spyOn(cli, '_theEnd');
      spyOn(cli._utils, 'exitWithError').and.returnValue(errorCb);

      let args = ['12345'];
      cli.run(args).then(() => {
        expect(cli._theEnd).not.toHaveBeenCalledWith('Test');
        expect(cli._utils.exitWithError).toHaveBeenCalledWith('ERROR_unexpected');
        expect(errorCb).toHaveBeenCalledWith('Test');

        done();
      });
    });

    it('should display the usage instructions (and exit) if `--usage` is detected', () => {
      spyOn(cli, '_displayUsage').and.callFake(() => {
        expect(process.exit).not.toHaveBeenCalled();
      });
      mergeSpy.and.callFake(() => {
        // `process.exit` is being stubbed (so the process isn't really terminated),
        // but it should have been called before calling `Merger.prototype.merge()`.
        expect(process.exit).toHaveBeenCalledWith(0);

        return new Promise(() => {});
      });

      let args = ['--usage'];
      cli.run(args);

      expect(cli._displayUsage).toHaveBeenCalled();
      expect(mergeSpy).toHaveBeenCalled();
    });

    it('should display the instructions (and exit) if `--instructions` is detected', () => {
      let mockInput = {instructions: true};

      spyOn(cli, '_getAndValidateInput').and.returnValue(mockInput);
      spyOn(cli, '_displayInstructions').and.callFake(() => {
        expect(process.exit).not.toHaveBeenCalled();
      });
      mergeSpy.and.callFake(() => {
        // `process.exit` is being stubbed (so the process isn't really terminated),
        // but it should have been called before calling `Merger.prototype.merge()`.
        expect(process.exit).toHaveBeenCalledWith(0);

        return new Promise(() => {});
      });

      cli.run([]);

      expect(cli._displayInstructions).toHaveBeenCalledWith(mockInput);
      expect(mergeSpy).toHaveBeenCalled();
    });
  });
});
