'use strict';

// Imports
let ngMaintainUtils = require('@gkalpak/ng-maintain-utils');

let AbstractCli = ngMaintainUtils.AbstractCli;
let GitUtils = ngMaintainUtils.GitUtils;

// Imports - Local
let Cli = require('../../lib/cli');
let Config = require('../../lib/config');
let Merger = require('../../lib/merger');

// Tests
describe('Cli', () => {
  let cli;

  beforeEach(() => {
    cli = new Cli();

    spyOn(console, 'log');
  });

  it('should extends `AbstractCli`', () => {
    expect(cli).toEqual(jasmine.any(Cli));
    expect(cli).toEqual(jasmine.any(AbstractCli));
  });

  describe('#constructor()', () => {
    it('should create a `Config` instance (and pass it to its super-constructor)', () => {
      expect(cli._config).toEqual(jasmine.any(Config));
    });

    it('should create a `GitUtils` instance', () => {
      expect(cli._gitUtils).toEqual(jasmine.any(GitUtils));
    });
  });

  describe('#_displayInstructions()', () => {
    beforeEach(() => {
      spyOn(AbstractCli.prototype, '_displayInstructions');
    });

    it('should call its super-method', () => {
      cli._displayInstructions([], {});

      expect(AbstractCli.prototype._displayInstructions).toHaveBeenCalled();
    });

    it('should pass `phases` to its super-method', () => {
      let phases = [];
      cli._displayInstructions(phases, {});

      expect(AbstractCli.prototype._displayInstructions.calls.argsFor(0)[0]).toBe(phases);
    });

    it('should pass an extended `input` object to its super-method', () => {
      spyOn(Merger, 'getPrUrl').and.returnValue('baz');
      spyOn(Merger, 'getTempBranch').and.returnValue('qux');

      cli._displayInstructions([], {foo: 'bar'});

      expect(AbstractCli.prototype._displayInstructions.calls.argsFor(0)[1]).toEqual({
        foo: 'bar',
        prUrl: 'baz',
        tempBranch: 'qux'
      });
    });

    it('should not modify the original `input` object', () => {
      let input = {foo: 'bar'};
      cli._displayInstructions([], input);

      expect(input).toEqual({foo: 'bar'});
    });
  });

  describe('#_theHappyEnd()', () => {
    beforeEach(() => {
      spyOn(AbstractCli.prototype, '_theHappyEnd');
    });

    it('should call its super-method', () => {
      cli._theHappyEnd();

      expect(AbstractCli.prototype._theHappyEnd).toHaveBeenCalled();
    });

    it('should not display "manually push the changes" if changes have been pushed', () => {
      cli._theHappyEnd(true);

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should display "manually push the changes" if changes have not been pushed', () => {
      cli._theHappyEnd();
      cli._theHappyEnd(false);

      expect(console.log).toHaveBeenCalledTimes(2);
      expect(console.log.calls.argsFor(0)[0]).toContain('manually push the changes');
      expect(console.log.calls.argsFor(1)[0]).toContain('manually push the changes');
    });

    it('should display "manually push the changes" AFTER calling its super-method', () => {
      AbstractCli.prototype._theHappyEnd.and.callFake(() => {
        expect(console.log).not.toHaveBeenCalled();
      });

      cli._theHappyEnd(false);

      expect(AbstractCli.prototype._theHappyEnd).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('#getPhases()', () => {
    it('should call and return `Merger.getPhases()`', () => {
      spyOn(Merger, 'getPhases').and.returnValues('foo', 'bar');

      expect(cli.getPhases()).toBe('foo');
      expect(cli.getPhases()).toBe('bar');
    });
  });

  describe('#run()', () => {
    let superDeferred;

    beforeEach(() => {
      superDeferred = null;

      spyOn(AbstractCli.prototype, 'run').and.callFake(() => new Promise((resolve, reject) => {
        superDeferred = {resolve, reject};
      }));
    });

    it('should call its super-method with the specified `rawArgs` and a callback', () => {
      cli.run(['foo', 'bar']);

      expect(AbstractCli.prototype.run).toHaveBeenCalledWith(['foo', 'bar'], jasmine.any(Function));
    });

    it('should return a promise', () => {
      let promise = cli.run([]);

      expect(promise).toEqual(jasmine.any(Promise));
    });

    it('should resolve the returned promise if the super-method resolves', done => {
      cli.
        run([]).
        then(value => expect(value).toBe('foo')).
        then(done);

      superDeferred.resolve('foo');
    });

    it('should reject the returned promise if the super-method rejects', done => {
      spyOn(cli._uiUtils, 'reportAndRejectFnGen').and.returnValue(() => Promise.reject());

      cli.
        run([]).
        catch(done);

      superDeferred.reject();
    });

    describe('- Doing work', () => {
      let input;
      let mergeSpy;

      beforeEach(() => {
        input = {};
        mergeSpy = spyOn(Merger.prototype, 'merge').and.returnValue(Promise.resolve('foo'));

        AbstractCli.prototype.run.and.callFake((_, doWork) => doWork(input));
      });

      it('should create a `Merger`', done => {
        cli.
          run([]).
          then(() => {
            expect(cli._merger).toEqual(jasmine.any(Merger));
            expect(cli._merger._cleanUper).toBeDefined();
            expect(cli._merger._utils).toBeDefined();
            expect(cli._merger._uiUtils).toBeDefined();
            expect(cli._merger._gitUtils).toBeDefined();
            expect(cli._merger._input).toBe(input);
          }).
          then(done);
      });

      it('should call `merge()` and return the returned value', done => {
        cli.
          run([]).
          then(value => expect(value).toBe('foo')).
          then(() => expect(mergeSpy).toHaveBeenCalled()).
          then(done);
      });
    });
  });
});
