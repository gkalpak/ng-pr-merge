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
      cli.
        run([]).
        catch(error => {
          expect(error).toBe('bar');

          done();
        });

      superDeferred.reject('bar');
    });

    it('should not display "manually push the changes" if changes have been pushed', done => {
      cli.
        run([]).
        then(() => expect(console.log).not.toHaveBeenCalled()).
        then(done);

      superDeferred.resolve(true);
    });

    it('should display "manually push the changes" if changes have not been pushed', done => {
      cli.
        run([]).
        then(() => expect(console.log).toHaveBeenCalled()).
        then(() => expect(console.log.calls.argsFor(0)[0]).toContain('manually push the changes')).
        then(done);

      superDeferred.resolve(false);
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
          then(() => expect(cli._merger).toEqual(jasmine.any(Merger))).
          then(() => expect(cli._merger._input).toBe(input)).
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
