'use strict';

// Imports
let chalk = require('chalk');
let childProcess = require('child_process');
let fs = require('fs');
let readline = require('readline');

// Imports - Local
let CleanUper = require('../../lib/clean-uper');
let Config = require('../../lib/config');
let Utils = require('../../lib/utils');

// Tests
describe('Utils', () => {
  let cleanUper;
  let config;
  let utils;

  beforeEach(() => {
    // These need to be spied on, before instantiating `Utils`
    spyOn(childProcess, 'exec');
    spyOn(fs, 'unlink');
    spyOn(fs, 'writeFile');

    cleanUper = new CleanUper();
    config = new Config();
    utils = new Utils(cleanUper, config.messages);
  });

  describe('#askQuestion()', () => {
    let mockRl;

    beforeEach(() => {
      mockRl = {
        close: jasmine.createSpy('rl.close()'),
        question: jasmine.createSpy('rl.question()').and.callFake((_, cb) => mockRl.answer = cb)
      };

      spyOn(readline, 'createInterface').and.returnValue(mockRl);
    });

    it('should return a promise', () => {
      expect(utils.askQuestion()).toEqual(jasmine.any(Promise));
    });

    it('should ask the specified question', () => {
      utils.askQuestion('foo');

      expect(mockRl.question).toHaveBeenCalledWith('foo', jasmine.any(Function));
    });

    it('should resolve the returned promise with the received answer', done => {
      utils.askQuestion().
        then(value => expect(value).toBe('bar')).
        then(done);

      mockRl.answer('bar');
    });

    it('should close the interface once the answer is received', () => {
      utils.askQuestion();
      expect(mockRl.close).not.toHaveBeenCalled();

      mockRl.answer();
      expect(mockRl.close).toHaveBeenCalled();
    });
  });

  describe('#askYesOrNoQuestion()', () => {
    let chalkEnabled;
    let answer;

    beforeEach(() => {
      chalkEnabled = chalk.enabled;
      chalk.enabled = false;

      answer = null;
      spyOn(utils, 'askQuestion').and.callFake(() => new Promise(resolve => answer = resolve));
    });

    afterEach(() => {
      chalk.enabled = chalkEnabled;
    });

    it('should return a promise', () => {
      expect(utils.askYesOrNoQuestion()).toEqual(jasmine.any(Promise));
    });

    it('should ask the specified question', () => {
      utils.askYesOrNoQuestion('foo');

      expect(utils.askQuestion.calls.argsFor(0)[0]).toContain('foo');
    });

    it('should append the available answer options (and highlight the default)', () => {
      utils.askYesOrNoQuestion('foo');
      utils.askYesOrNoQuestion('bar', false);
      utils.askYesOrNoQuestion('baz', true);

      expect(utils.askQuestion.calls.argsFor(0)[0]).toContain('foo [y/N]');
      expect(utils.askQuestion.calls.argsFor(1)[0]).toContain('bar [y/N]');
      expect(utils.askQuestion.calls.argsFor(2)[0]).toContain('baz [Y/n]');
    });

    it('should resolve the returned promise if the answer is "yes"', done => {
      let promises = [];

      promises.push(utils.askYesOrNoQuestion());
      answer('yes');

      promises.push(utils.askYesOrNoQuestion('', false));
      answer('yes');

      promises.push(utils.askYesOrNoQuestion('', true));
      answer('yes');

      Promise.all(promises).then(done);
    });

    it('should reject the returned promise if the answer is "no"', done => {
      let promises = [];

      promises.push(reversePromise(utils.askYesOrNoQuestion()));
      answer('no');

      promises.push(reversePromise(utils.askYesOrNoQuestion('', false)));
      answer('no');

      promises.push(reversePromise(utils.askYesOrNoQuestion('', true)));
      answer('no');

      Promise.all(promises).then(done);
    });

    it('should ignore case and also accept single-letter answers (default: no)', done => {
      let yesAnswers = ['y', 'Y', 'yes', 'Yes', 'yEs', 'YES'];
      let noAnswers = ['n', 'NO', 'foo', 'yesss', ''];

      let yesPromises = yesAnswers.map(ans => {
        let promise = utils.askYesOrNoQuestion();
        answer(ans);

        return promise;
      });

      let noPromises = noAnswers.map(ans => {
        let promise = utils.askYesOrNoQuestion();
        answer(ans);

        return reversePromise(promise);
      });

      Promise.all(yesPromises.concat(noPromises)).then(done);
    });

    it('should ignore case and also accept single-letter answers (default: yes)', done => {
      let yesAnswers = ['y', 'YES', 'bar', 'nooo', ''];
      let noAnswers = ['n', 'N', 'no', 'No', 'nO', 'NO'];

      let yesPromises = yesAnswers.map(ans => {
        let promise = utils.askYesOrNoQuestion('', true);
        answer(ans);

        return promise;
      });

      let noPromises = noAnswers.map(ans => {
        let promise = utils.askYesOrNoQuestion('', true);
        answer(ans);

        return reversePromise(promise);
      });

      Promise.all(yesPromises.concat(noPromises)).then(done);
    });
  });

  describe('#exitWithError()', () => {
    beforeEach(() => {
      spyOn(console, 'error');
      spyOn(console, 'log');
      spyOn(process, 'exit');

      spyOn(cleanUper, 'hasTasks');
      spyOn(utils, 'offerToCleanUp').and.returnValue(Promise.resolve());
    });

    it('should return a function', () => {
      let fn = utils.exitWithError();

      expect(fn).toEqual(jasmine.any(Function));
    });

    describe('returned function', () => {
      it('should log to the console the specified error (if any)', () => {
        utils.exitWithError()('Test');

        expect(console.error.calls.argsFor(0)[1]).toBe('Test');
      });

      it('should mention that the operation was aborted', () => {
        utils.exitWithError()();

        expect(console.error.calls.argsFor(0)[0]).toContain('OPERATION ABORTED');
      });

      it('should retrieve the error message based on the specified `errCode`', () => {
        config.messages.errors.foo = 'bar';
        utils.exitWithError('foo')();

        expect(console.error.calls.argsFor(0)[0]).toContain('ERROR: bar');
      });

      it('should use `errCode` itself if it does not match any error message ', () => {
        utils.exitWithError('unknown errCode')();

        expect(console.error.calls.argsFor(0)[0]).toContain('ERROR: unknown errCode');
      });

      it('should use a default error message if `errCode` is falsy', () => {
        utils.exitWithError()();
        utils.exitWithError(null)();
        utils.exitWithError(false)();
        utils.exitWithError(0)();
        utils.exitWithError('')();

        console.error.calls.allArgs().forEach(args => {
          expect(args[0]).toContain('ERROR: <no error code>');
        });
      });

      it('should offer to clean up if `cleanUper` has scheduled tasks', done => {
        cleanUper.hasTasks.and.returnValues(false, true);
        let fn = utils.exitWithError();

        fn();
        expect(utils.offerToCleanUp).not.toHaveBeenCalled();

        fn().then(done);
        expect(utils.offerToCleanUp).toHaveBeenCalledTimes(1);
      });

      it('should not offer to clean up if `skipCleanUp` is `true`', () => {
        cleanUper.hasTasks.and.returnValue(true);
        let fn = utils.exitWithError(null, true);

        fn();
        expect(utils.offerToCleanUp).not.toHaveBeenCalled();
      });

      it('should exit (with error) after having cleaned up (if necessary)', done => {
        cleanUper.hasTasks.and.returnValues(false, true);
        let fn = utils.exitWithError();

        // No clean-up
        fn();

        expect(process.exit).toHaveBeenCalledWith(1);
        process.exit.calls.reset();

        // Clean-up
        utils.offerToCleanUp.and.callFake(() => {
          expect(process.exit).not.toHaveBeenCalled();
          return Promise.resolve();
        });

        fn().
          then(() => expect(process.exit).toHaveBeenCalledWith(1)).
          then(done);
      });

      it('should exit even if cleaning up errors', done => {
        cleanUper.hasTasks.and.returnValue(true);
        utils.offerToCleanUp.and.callFake(() => {
          expect(process.exit).not.toHaveBeenCalled();
          return Promise.reject();
        });

        utils.exitWithError()().
          then(() => expect(process.exit).toHaveBeenCalledWith(1)).
          then(done);
      });

      it('should log the error to the console when cleaning up errors', done => {
        cleanUper.hasTasks.and.returnValue(true);
        utils.offerToCleanUp.and.returnValue(Promise.reject('Test'));

        utils.exitWithError()().
          then(() => expect(console.error.calls.mostRecent().args[1]).toBe('Test')).
          then(done);
      });
    });
  });

  describe('#getRunWithNodeCmd()', () => {
    it('should include the `node` executable', () => {
      expect(utils.getRunWithNodeCmd('foo')).toMatch(/^node/i);
    });

    it('should include the script filepath from inside the module\'s `bin/` directory', () => {
      expect(utils.getRunWithNodeCmd('foo')).toMatch(/node_modules.+foo.+bin.+foo/);
    });

    it('should surround the script filepath in double quotes', () => {
      expect(utils.getRunWithNodeCmd('foo')).toMatch(/ "[^"]+"$/);
    });

    it('should append any arguments separated by space', () => {
      let baseCmd = utils.getRunWithNodeCmd('foo');
      let cmdWithArgs = `${baseCmd} --bar --baz=qux`;

      expect(utils.getRunWithNodeCmd('foo', [])).toBe(baseCmd);
      expect(utils.getRunWithNodeCmd('foo', ['--bar', '--baz=qux'])).toBe(cmdWithArgs);
    });
  });

  describe('#interpolate()', () => {
    let data;

    beforeEach(() => {
      data = {
        '': 'empty',
        '  ': 'spaces',
        ' foo ': ' bar ',
        foo: 'bar',
        baz: 'qux'
      };
    });

    it('should replace `${...}`', () => {
      let input = '${foo}';
      let expected = 'bar';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should replace all instances', () => {
      let input = ' ${foo} ${baz} ${foo} ';
      let expected = ' bar qux bar ';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should not trim keys', () => {
      let input = '${ foo }';
      let expected = ' bar ';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should accept space-only and zero-length keys', () => {
      let input = '${} ${  }';
      let expected = 'empty spaces';

      expect(utils.interpolate(input, data)).toBe(expected);
    });

    it('should replace unknown keys with "undefined"', () => {
      let input = '${unknown}';
      let expected = 'undefined';

      expect(utils.interpolate(input, data)).toBe(expected);
    });
  });

  describe('#offerToCleanUp()', () => {
    let deferred;

    beforeEach(() => {
      spyOn(console, 'log');
      spyOn(cleanUper, 'cleanUp');

      spyOn(utils, 'phase').and.callFake((phaseId, doWork, skipCleanUp) => {
        expect(phaseId).toBe('X');
        expect(doWork).toEqual(jasmine.any(Function));
        expect(skipCleanUp).toBe(true);

        return Promise.resolve().then(doWork);
      });

      spyOn(utils, 'askYesOrNoQuestion').and.callFake(question => {
        expect(question).toContain(config.messages.offerToCleanUp);

        return new Promise((resolve, reject) => deferred = {resolve, reject});
      });
    });

    it('should return a promise', () => {
      expect(utils.offerToCleanUp()).toEqual(jasmine.any(Promise));
    });

    it('should ask confirmation', () => {
      utils.offerToCleanUp();

      expect(utils.askYesOrNoQuestion).toHaveBeenCalled();
    });

    it('should enter phase `X` and clean up if the user confirms', done => {
      utils.offerToCleanUp().
        then(() => {
          expect(utils.phase).toHaveBeenCalled();
          expect(cleanUper.cleanUp).toHaveBeenCalledWith();
        }).
        then(done);

      deferred.resolve();
    });

    it('should only display clean-up tasks if the user does not confirm', done => {
      utils.offerToCleanUp().
        then(() => {
          expect(utils.phase).not.toHaveBeenCalled();
          expect(cleanUper.cleanUp).toHaveBeenCalledWith(true);
        }).
        then(done);

      deferred.reject();
    });
  });

  describe('#phase()', () => {
    let dummyDoWork;

    beforeEach(() => {
      dummyDoWork = () => new Promise(() => {});
      config.messages.phases.foo = {description: 'bar'};

      spyOn(console, 'log');
      spyOn(utils, 'exitWithError');
    });

    it('should log the phase\'s ID and description to the console', () => {
      utils.phase('foo', dummyDoWork);

      expect(console.log.calls.argsFor(0)[0]).toMatch(/\WPHASE foo\W+bar\W/);
    });

    it('should only accept a `doWork` callback that returns a promise', () => {
      expect(() => utils.phase('foo', {})).toThrow();
      expect(() => utils.phase('foo', () => {})).toThrow();
      expect(() => utils.phase('foo', dummyDoWork)).not.toThrow();
    });

    it('should return a promise', () => {
      expect(utils.phase('foo', dummyDoWork)).toEqual(jasmine.any(Promise));
    });

    it('should resolve the returned promise with the value "returned" by `doWork()`', done => {
      utils.phase('foo', () => Promise.resolve('bar')).
        then(value => expect(value).toBe('bar')).
        then(done);
    });

    it('should report to the console when the work is done', done => {
      let doWork = () => {
        expect(console.log.calls.mostRecent().args[0]).not.toContain('done');
        return Promise.resolve();
      };

      utils.phase('foo', doWork).
        then(() => expect(console.log.calls.mostRecent().args[0]).toContain('done')).
        then(done);
    });

    it('should not report to the console if `doWork()` errors', done => {
      let doWork = () => {
        console.log.calls.reset();
        return Promise.reject();
      };

      utils.phase('foo', doWork).
        catch(() => expect(console.log).not.toHaveBeenCalled()).
        then(done);
    });

    it('should set up an error callback with the appropriate error code', done => {
      let doWork = () => Promise.reject('foo');
      let errorCb = jasmine.createSpy('errorCb');
      utils.exitWithError.and.returnValue(errorCb);

      utils.phase('foo', doWork).
        catch(() => {
          expect(utils.exitWithError.calls.argsFor(0)[0]).toBe('ERROR_phasefoo');
          expect(errorCb).toHaveBeenCalledWith('foo');
        }).
        then(done);
    });

    it('should support skipping clean-up', () => {
      utils.phase('foo', dummyDoWork);
      utils.phase('foo', dummyDoWork, false);
      utils.phase('foo', dummyDoWork, true);

      expect(utils.exitWithError.calls.argsFor(0)[1]).toBeFalsy();
      expect(utils.exitWithError.calls.argsFor(1)[1]).toBeFalsy();
      expect(utils.exitWithError.calls.argsFor(2)[1]).toBeTruthy();
    });
  });

  describe('#removeSurroundingQuotes()', () => {
    it('should return the passed in Object', () => {
      let input = {foo: '"bar"', baz: '"qux"'};
      let output = utils.removeSurroundingQuotes(input);

      expect(output).toBe(input);
    });

    it('should remove surrounding double-quotes', () => {
      let input = {foo: '"bar"', baz: '"qux"'};
      let output = utils.removeSurroundingQuotes(input);

      expect(output).toEqual({foo: 'bar', baz: 'qux'});
    });

    it('should remove surrounding single-quotes', () => {
      let input = {foo: '\'bar\'', baz: '\'qux\''};
      let output = utils.removeSurroundingQuotes(input);

      expect(output).toEqual({foo: 'bar', baz: 'qux'});
    });

    it('should not remove non-matching quotes', () => {
      let input = {foo: '"bar\'', baz: '\'qux"'};
      let output = utils.removeSurroundingQuotes(input);

      expect(output).toEqual({foo: '"bar\'', baz: '\'qux"'});
    });

    it('should process top-level properties only', () => {
      let input = {foo: {bar: '"bar"'}, baz: ['"qux"']};
      let output = utils.removeSurroundingQuotes(input);

      expect(output).toEqual({foo: {bar: '"bar"'}, baz: ['"qux"']});
    });

    it('should remove the outer-most pair of quotes only', () => {
      let input = {foo: '"\'bar\'"', baz: '\'"qux"\''};
      let output = utils.removeSurroundingQuotes(input);

      expect(output).toEqual({foo: '\'bar\'', baz: '"qux"'});
    });
  });

  describe('#spawnAsPromised()', () => {
    let ChildProcess = childProcess.ChildProcess;
    let spawned;

    beforeEach(() => {
      spawned = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => createMockProcess());

      let spy = spyOn(childProcess, 'spawn');
      spy.and.returnValues.apply(spy.and, spawned);
    });

    it('should spawn a process for the specified command', () => {
      utils.spawnAsPromised('foo bar');

      expect(childProcess.spawn).toHaveBeenCalledWith('foo', ['bar'], jasmine.any(Object));
    });

    it('should parse the specified command (respecting double-quoted values)', () => {
      let parsedArgs;

      utils.spawnAsPromised('foo     "bar" --baz --qux="foo bar" "baz qux"');
      parsedArgs = ['"bar"', '--baz', '--qux="foo bar"', '"baz qux"'];

      expect(childProcess.spawn).toHaveBeenCalledWith('foo', parsedArgs, jasmine.any(Object));

      utils.spawnAsPromised('"foo"     "bar" --baz --qux="foo bar" "baz qux"');
      parsedArgs = ['"bar"', '--baz', '--qux="foo bar"', '"baz qux"'];

      expect(childProcess.spawn).toHaveBeenCalledWith('"foo"', parsedArgs, jasmine.any(Object));
    });

    it('should support command "piping" (and spawn a process for each command)', () => {
      let anyObj = jasmine.any(Object);

      utils.spawnAsPromised('foo bar | bar "baz" | "baz" qux');

      expect(childProcess.spawn).toHaveBeenCalledTimes(3);

      expect(childProcess.spawn.calls.argsFor(0)).toEqual(['foo', ['bar'], anyObj]);
      expect(childProcess.spawn.calls.argsFor(1)).toEqual(['bar', ['"baz"'], anyObj]);
      expect(childProcess.spawn.calls.argsFor(2)).toEqual(['"baz"', ['qux'], anyObj]);

      expect(spawned[0].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[1].stdin);
      expect(spawned[1].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[2].stdin);
    });

    it('should use appropriate values for `stdio`', () => {
      let expectedOptions;

      utils.spawnAsPromised('foo bar');
      expectedOptions = {stdio: ['inherit', 'inherit', 'inherit']};

      expect(childProcess.spawn.calls.argsFor(0)[2]).toEqual(expectedOptions);
      childProcess.spawn.calls.reset();

      utils.spawnAsPromised('foo bar | bar "baz" | "baz" qux');
      expectedOptions = [
        {stdio: ['inherit', 'pipe', 'inherit']},
        {stdio: ['pipe', 'pipe', 'inherit']},
        {stdio: ['pipe', 'inherit', 'inherit']}
      ];

      expect(childProcess.spawn.calls.argsFor(0)[2]).toEqual(expectedOptions[0]);
      expect(childProcess.spawn.calls.argsFor(1)[2]).toEqual(expectedOptions[1]);
      expect(childProcess.spawn.calls.argsFor(2)[2]).toEqual(expectedOptions[2]);
    });

    it('should support specifying a custom input stream', () => {
      let inputStream = {pipe: jasmine.createSpy('inputStream.pipe')};
      let expectedOptions;

      utils.spawnAsPromised('foo bar', inputStream);
      expectedOptions = {stdio: ['pipe', 'inherit', 'inherit']};

      expect(childProcess.spawn.calls.argsFor(0)[2]).toEqual(expectedOptions);
      expect(inputStream.pipe).toHaveBeenCalledWith(spawned[0].stdin);
      childProcess.spawn.calls.reset();
      inputStream.pipe.calls.reset();

      utils.spawnAsPromised('foo bar | bar "baz" | "baz" qux', inputStream);
      expectedOptions = [
        {stdio: ['pipe', 'pipe', 'inherit']},
        {stdio: ['pipe', 'pipe', 'inherit']},
        {stdio: ['pipe', 'inherit', 'inherit']}
      ];

      expect(childProcess.spawn.calls.argsFor(0)[2]).toEqual(expectedOptions[0]);
      expect(childProcess.spawn.calls.argsFor(1)[2]).toEqual(expectedOptions[1]);
      expect(childProcess.spawn.calls.argsFor(2)[2]).toEqual(expectedOptions[2]);
      expect(inputStream.pipe).toHaveBeenCalledTimes(1);
      expect(inputStream.pipe.calls.argsFor(0)[0]).toBe(spawned[1].stdin);
      expect(spawned[1].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[2].stdin);
      expect(spawned[2].stdout.pipe.calls.argsFor(0)[0]).toBe(spawned[3].stdin);
    });

    it('should return a promise', () => {
      expect(utils.spawnAsPromised('foo')).toEqual(jasmine.any(Promise));
    });

    it('should reject the returned promise if a spawned process errors (single command)', done => {
      utils.spawnAsPromised('foo').
        catch(err => expect(err).toBe('Test')).
        then(done);

      spawned[0].emit('error', 'Test');
    });

    it('should reject the returned promise if a spawned process errors (piped commands)', done => {
      let promises = [];

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[0].emit('error', 'Test0');
      childProcess.spawn.calls.reset();

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[4].emit('error', 'Test1');
      childProcess.spawn.calls.reset();

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[8].emit('error', 'Test2');

      Promise.all(promises).
        then(values => expect(values).toEqual(['Test0', 'Test1', 'Test2'])).
        then(done);
    });

    it('should reject the returned promise if a spawned process exits with error', done => {
      let promises = [];

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[0].emit('exit', 1);
      childProcess.spawn.calls.reset();

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[3].emit('exit', 0);
      spawned[4].emit('exit', null, 33);
      childProcess.spawn.calls.reset();

      promises.push(reversePromise(utils.spawnAsPromised('foo | bar | baz')));
      spawned[6].emit('exit', 0);
      spawned[8].emit('exit', 7);

      Promise.all(promises).
        then(values => expect(values).toEqual([1, 33, 7])).
        then(done);
    });

    it('should resolve the returned promise when all spawned processes complete (single command)',
      done => {
        let resolved = jasmine.createSpy('resolved');

        utils.spawnAsPromised('foo').then(resolved);
        spawned[0].emit('exit', 0);

        // The promise's success handlers are executed asynchronously
        expect(resolved).not.toHaveBeenCalled();

        setTimeout(() => {
          expect(resolved).toHaveBeenCalled();

          done();
        });
      }
    );

    it('should resolve the returned promise when all spawned processes complete (piped commands)',
      done => {
        let resolved = jasmine.createSpy('resolved');

        utils.spawnAsPromised('foo | bar | baz').then(resolved);
        spawned[0].emit('exit', 0);

        setTimeout(() => {
          expect(resolved).not.toHaveBeenCalled();
          spawned[1].emit('exit', 0);

          setTimeout(() => {
            expect(resolved).not.toHaveBeenCalled();
            spawned[2].emit('exit', 0);

            // The promise's success handlers are executed asynchronously
            expect(resolved).not.toHaveBeenCalled();

            setTimeout(() => {
              expect(resolved).toHaveBeenCalled();

              done();
            });
          });
        });
      }
    );

    // Helpers
    function createMockProcess() {
      let proc = new ChildProcess();

      proc.stdin = {};
      proc.stdout = {pipe: jasmine.createSpy('mockProcess.stdout.pipe')};

      return proc;
    }
  });

  describe('#waitAsPromised()', () => {
    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should return a promise', () => {
      expect(utils.waitAsPromised()).toEqual(jasmine.any(Promise));
    });

    it('should resolve the returned promise after `period` milliseconds', done => {
      let resolved = jasmine.createSpy('resolved');
      utils.waitAsPromised(500).then(resolved);

      Promise.resolve().
        then(() => expect(resolved).not.toHaveBeenCalled()).
        then(() => jasmine.clock().tick(499)).
        then(() => expect(resolved).not.toHaveBeenCalled()).
        then(() => jasmine.clock().tick(1)).
        then(() => expect(resolved).toHaveBeenCalled()).
        then(done);
    });
  });

  [
    {
      module: childProcess,
      moduleName: 'child_process',
      methodName: 'exec'
    },
    {
      module: fs,
      moduleName: 'fs',
      methodName: 'unlink'
    },
    {
      module: fs,
      moduleName: 'fs',
      methodName: 'writeFile'
    }
  ].forEach(spec => {
    let modAndMethodName;
    let modMethod;
    let utilsMethodName;
    let utilsMethod;

    describe(`#${utilsMethodName}()`, () => {
      beforeEach(() => {
        modAndMethodName = `${spec.moduleName}.${spec.methodName}`;
        modMethod = spec.module[spec.methodName];
        utilsMethodName = `${spec.methodName}AsPromised`;
        utilsMethod = utils[utilsMethodName];
      });

      it('should return a promise', () => {
        expect(utilsMethod()).toEqual(jasmine.any(Promise));
      });

      it(`should call \`${modAndMethodName}()\``, () => {
        utilsMethod();

        expect(modMethod).toHaveBeenCalled();
      });

      it(`should pass any arguments through to \`${modAndMethodName}()\``, () => {
        utilsMethod('foo', 'bar');
        let args = modMethod.calls.argsFor(0);

        expect(args[0]).toBe('foo');
        expect(args[1]).toBe('bar');
      });

      it(`should pass a callback as last argument \`${modAndMethodName}()\``, () => {
        utilsMethod('foo', 'bar');
        let args = modMethod.calls.argsFor(0);

        expect(args[2]).toEqual(jasmine.any(Function));
      });

      it('should reject the returned promise with the error passed to the callback', done => {
        modMethod.and.callFake(cb => cb('Test'));

        utilsMethod().
          catch(err => expect(err).toBe('Test')).
          then(done);
      });

      it('should resolve the returned promise with the output passed to the callback', done => {
        modMethod.and.callFake(cb => cb(null, 'Test'));

        utilsMethod().
          then(out => expect(out).toBe('Test')).
          then(done);
      });
    });
  });

  // Helpers
  function reversePromise(promise) {
    // "Reverse" the promise; i.e the desired outcome is for this promise to be rejected.
    return promise.then(v => Promise.reject(v), e => Promise.resolve(e));
  }
});
