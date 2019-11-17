'use strict';

// Imports
let ClaChecker = require('@gkalpak/ng-cla-check');
let ngMaintainUtils = require('@gkalpak/ng-maintain-utils');

let CleanUper = ngMaintainUtils.CleanUper;
let GitUtils = ngMaintainUtils.GitUtils;
let Logger = ngMaintainUtils.Logger;
let Phase = ngMaintainUtils.Phase;
let UiUtils = ngMaintainUtils.UiUtils;
let Utils = ngMaintainUtils.Utils;

// Imports - Local
let Merger = require('../../lib/merger');

// Tests
describe('Merger', () => {
  let phaseIds = ['1', '2', '3', '4', '5', '6', '7'];
  let phaseIdsWithoutError = ['4'];
  let logger;
  let cleanUper;
  let gitUtils;
  let uiUtils;
  let utils;

  beforeEach(() => {
    logger = new Logger();
    cleanUper = new CleanUper(logger);
    utils = new Utils();
    uiUtils = new UiUtils(logger, cleanUper, {});
    gitUtils = new GitUtils(cleanUper, utils);
  });

  describe('Merger#getPhases()', () => {
    let phases;

    beforeEach(() => {
      phases = Merger.getPhases();
    });

    it('should return an array (Phase[])', () => {
      expect(phases).toBeDefined();
      expect(phases).toEqual(jasmine.any(Array));

      phases.forEach(phase => {
        expect(phase).toBeDefined();
        expect(phase).toEqual(jasmine.any(Phase));
      });
    });

    phaseIds.forEach(id => {
      describe(`- Phase ${id}`, () => {
        let hasError = phaseIdsWithoutError.indexOf(id) === -1;
        let phase;

        beforeEach(() => {
          phase = phases.find(phase => phase.id === id);
        });

        it('should exist', () => {
          expect(phase).toBeDefined();
        });

        it(`should${hasError ? '' : ' not'} have an error message`, () => {
          if (hasError) {
            expect(phase.error).toBeDefined();
            expect(phase.error).toEqual(jasmine.any(String));
          } else {
            expect(phase.error).toBeNull();
          }
        });
      });
    });
  });

  describe('Merger#getPrUrl()', () => {
    it('should return the GitHub patch URL for the specified `repo`/`prNo`', () => {
      let actual = Merger.getPrUrl('foo', 12345);
      let expected = 'https://patch-diff.githubusercontent.com/raw/foo/pull/12345.patch';

      expect(actual).toBe(expected);
    });
  });

  describe('Merger#getTempBranch()', () => {
    it('should return the temporary branch name for the specified `prNo`', () => {
      let actual = Merger.getTempBranch(12345);
      let expected = 'pr-12345';

      expect(actual).toBe(expected);
    });
  });

  describe('#constructor()', () => {
    it('should accept `logger, `cleanUper`, `utils`, `uiUtils`, `gitUtils` and `input` arguments',
      () => {
        let input = {};
        let merger = createMerger(input);

        expect(merger._logger).toBe(logger);
        expect(merger._cleanUper).toBe(cleanUper);
        expect(merger._utils).toBe(utils);
        expect(merger._uiUtils).toBe(uiUtils);
        expect(merger._gitUtils).toBe(gitUtils);
        expect(merger._input).toBe(input);
      }
    );

    it('should create a `_claChecker` property (ClaChecker)', () => {
      let merger = createMerger({});

      expect(merger._claChecker).toEqual(jasmine.any(ClaChecker));
    });

    it('should create a `_phases` property', () => {
      spyOn(Merger, 'getPhases').and.returnValue('foo');
      let merger = createMerger({});

      expect(merger._phases).toBe('foo');
    });

    it('should create a `_tempBranch` property', () => {
      spyOn(Merger, 'getTempBranch').and.returnValue('bar');
      let merger = createMerger({});

      expect(merger._tempBranch).toBe('bar');
    });

    describe('- Clean-up tasks', () => {
      beforeEach(() => {
        spyOn(cleanUper, 'registerTask').and.returnValue({});
      });

      it('should be registered', () => {
        createMerger({});

        expect(cleanUper.registerTask).toHaveBeenCalledTimes(5);
      });

      it('should include an `abortRebase` task', () => {
        spyOn(gitUtils, 'abortRebase').and.returnValue(Promise.reject());

        let merger = createMerger({});
        cleanUper.registerTask.calls.argsFor(0)[1]();

        expect(merger._cleanUpTasks.abortRebase).toBeDefined();
        expect(gitUtils.abortRebase).toHaveBeenCalledWith();
      });

      it('should include an `cleanUntracked` task', () => {
        spyOn(gitUtils, 'clean');

        let merger = createMerger({});
        cleanUper.registerTask.calls.argsFor(1)[1]();

        expect(merger._cleanUpTasks.cleanUntracked).toBeDefined();
        expect(gitUtils.clean).toHaveBeenCalledWith();
      });

      it('should include an `checkoutBranch` task', () => {
        spyOn(gitUtils, 'checkout');

        let merger = createMerger({branch: 'foo'});
        cleanUper.registerTask.calls.argsFor(2)[1]();

        expect(merger._cleanUpTasks.checkoutBranch).toBeDefined();
        expect(gitUtils.checkout).toHaveBeenCalledWith('foo');
      });

      it('should include an `deleteTempBranch` task', () => {
        spyOn(gitUtils, 'deleteBranch');

        let merger = createMerger({});
        cleanUper.registerTask.calls.argsFor(3)[1]();

        expect(merger._cleanUpTasks.deleteTempBranch).toBeDefined();
        expect(gitUtils.deleteBranch).toHaveBeenCalledWith(merger._tempBranch, true);
      });

      it('should include an `hardReset` task', () => {
        spyOn(gitUtils, 'reset');

        let merger = createMerger({branch: 'foo'});
        cleanUper.registerTask.calls.argsFor(4)[1]();

        expect(merger._cleanUpTasks.hardReset).toBeDefined();
        expect(gitUtils.reset).toHaveBeenCalledWith('origin/foo', true);
      });
    });
  });

  describe('#_getNewMessage()', () => {
    let merger;

    beforeEach(() => {
      merger = createMerger({repo: '', branch: 'baz-qux', prNo: 12345});
    });

    it('should append `Closes #<PRNO>` at the end of the message', () => {
      let oldMessage = 'foo bar';
      let newMessage = merger._getNewMessage(oldMessage);

      expect(newMessage).toBe('foo bar\n\nCloses #12345');
    });

    it('should not append `Closes #<PRNO>` if an equivalent note is already present', () => {
      let oldMessages = {
        withNote: [
          'close #12345',
          '\nClOsEs #12345  ',
          '\n  CLOSED #12345',
          '\n  Fix #12345',
          '\r\n\r\nFixes #12345 ',
          'Fixed #12345.',
          'Resolve #12345o',
          'foo\n\nbar\n\nresolves #12345 Happy now?',
          'REsoLVed #12345'
        ],
        withoutNote: [
          'foo. Closes #12345',
          'Encloses #12345',
          'Opens #12345',
          'Closes 12345',
          'Closes #1234',
          'Closes #123456'
        ]
      };
      let newMessages = {
        withNote: oldMessages.withNote.map(oldMessage => merger._getNewMessage(oldMessage)),
        withoutNote: oldMessages.withoutNote.map(oldMessage => merger._getNewMessage(oldMessage))
      };

      newMessages.withNote.forEach(newMessage => {
        expect(newMessage).not.toMatch(/\n\nCloses #12345$/);
      });
      newMessages.withoutNote.forEach(newMessage => {
        expect(newMessage).toMatch(/\n\nCloses #12345$/);
      });
    });

    it('should trim whitespace and normalize line-endings (always)', () => {
      let oldMessages = [
        ' \t\r\n foo \t\r\n bar \t\n baz \t\n ',
        ' \t\r\n foo \t\r\n bar \t\n baz \t\n Closes #12345',
      ];
      let newMessages = oldMessages.map(oldMessage => merger._getNewMessage(oldMessage));

      expect(newMessages).toEqual([
        'foo \t\n bar \t\n baz\n\nCloses #12345',
        'foo \t\n bar \t\n baz \t\n Closes #12345'
      ]);
    });

    it('should insert `Closes #<PRNO>` above "BREAKING CHANGE:"', () => {
      let oldMessages = [
        'foo\nBREAKING CHANGE: It is broken.',
        'bar\n  BREAKING CHANGE: It is broken.',
        'baz\nBREAKING CHANGE:',
        'qux\n\n\nBREAKING CHANGE:',

        'foo\nIt is a BREAKING CHANGE: It is broken.',
        'bar\nBreaking Change: It is broken.',
        'baz\nPOSSIBLE BREAKING CHANGE: It might be broken.',
        'qux\nBREAKING CHANGE'
      ];
      let newMessages = oldMessages.map(oldMessage => merger._getNewMessage(oldMessage));

      expect(newMessages).toEqual([
        'foo\n\nCloses #12345\nBREAKING CHANGE: It is broken.',
        'bar\n\nCloses #12345\n  BREAKING CHANGE: It is broken.',
        'baz\n\nCloses #12345\nBREAKING CHANGE:',
        'qux\n\nCloses #12345\n\n\nBREAKING CHANGE:',

        'foo\nIt is a BREAKING CHANGE: It is broken.\n\nCloses #12345',
        'bar\nBreaking Change: It is broken.\n\nCloses #12345',
        'baz\nPOSSIBLE BREAKING CHANGE: It might be broken.\n\nCloses #12345',
        'qux\nBREAKING CHANGE\n\nCloses #12345'
      ]);
    });
  });

  describe('#merge()', () => {
    let merger;

    beforeEach(() => {
      merger = createMerger({repo: 'foo/bar', branch: 'baz-qux', prNo: 12345});

      phaseIds.forEach(id => {
        let methodName = `phase${id}`;
        spyOn(merger, methodName).and.returnValue(Promise.resolve(methodName));
      });
    });

    it('should return a promise', done => {
      let promise = merger.merge().then(done, done.fail);

      expect(promise).toEqual(jasmine.any(Promise));
    });

    it('should run all phases (and resolve the returned promise)', done => {
      let lastId = phaseIds[phaseIds.length - 1];

      merger.merge().
        then(value => {
          expect(value).toBe(`phase${lastId}`);
          phaseIds.forEach(id => {
            expect(merger[`phase${id}`]).toHaveBeenCalled();
          });
        }).
        then(done, done.fail);
    });

    it('should abort (and reject the returned promise) if any phase errors', done => {
      let errorId = '4';
      let errorIdIdx = phaseIds.indexOf(errorId);

      merger[`phase${errorId}`].and.returnValue(Promise.reject('Test'));

      merger.merge().
        then(done.fail, err => {
          expect(err).toBe('Test');

          phaseIds.forEach((id, idx) => {
            let method = merger[`phase${id}`];

            if (idx > errorIdIdx) {
              expect(method).not.toHaveBeenCalled();
            } else {
              expect(method).toHaveBeenCalled();
            }
          });

          done();
        });
    });
  });

  describe('- Phases:', () => {
    let input;
    let merger;
    let doWork;
    let returnedPromise;

    beforeEach(() => {
      input = {repo: 'foo/bar', branch: 'baz-qux', prNo: 12345};
      merger = createMerger(input);
      doWork = null;
      returnedPromise = null;

      spyOn(uiUtils, 'phase').and.callFake((_, cb) => {
        doWork = cb;
        returnedPromise = new Promise(() => {});

        return returnedPromise;
      });
    });

    describe('#phase1()', () => {
      it('should call `uiUtils.phase()` (and return the returned value)', () => {
        let phase = jasmine.objectContaining({id: '1'});
        let value = merger.phase1();

        expect(uiUtils.phase).toHaveBeenCalledWith(phase, jasmine.any(Function));
        expect(value).toBe(returnedPromise);
      });

      it('should check the CLA signature', () => {
        spyOn(merger._claChecker, 'check').and.returnValue(Promise.resolve());

        merger.phase1();
        doWork();

        expect(merger._claChecker.check).toHaveBeenCalledWith(12345);
      });

      it('should ask confirmation if the CLA signature check fails', done => {
        spyOn(uiUtils, 'askYesOrNoQuestion');
        spyOn(merger._claChecker, 'check').and.returnValue(Promise.reject());

        merger.phase1();
        doWork();

        setTimeout(() => {
          expect(uiUtils.askYesOrNoQuestion).toHaveBeenCalled();

          done();
        });
      });

      it('should resolve the returned promise if the user confirms', done => {
        spyOn(uiUtils, 'askYesOrNoQuestion').and.returnValue(Promise.resolve());
        spyOn(merger._claChecker, 'check').and.returnValue(Promise.reject());

        merger.phase1();
        doWork().
          then(() => expect(uiUtils.askYesOrNoQuestion).toHaveBeenCalled()).
          then(done, done.fail);
      });

      it('should reject the returned promise if the user does not confirm', done => {
        spyOn(uiUtils, 'askYesOrNoQuestion').and.returnValue(Promise.reject());
        spyOn(merger._claChecker, 'check').and.returnValue(Promise.reject());

        merger.phase1();
        doWork().
          then(() => expect(uiUtils.askYesOrNoQuestion).toHaveBeenCalled()).
          catch(done);
      });
    });

    describe('#phase2()', () => {
      let promise;

      beforeEach(() => {
        spyOn(cleanUper, 'schedule');
        spyOn(cleanUper, 'unschedule');
        spyOn(gitUtils, 'checkout');
        spyOn(gitUtils, 'createBranch');
        spyOn(gitUtils, 'mergePullRequest');
        spyOn(gitUtils, 'pull');

        promise = merger.phase2();
      });

      it('should call `uiUtils.phase()` (and return the returned value)', () => {
        let phase = jasmine.objectContaining({id: '2'});

        expect(uiUtils.phase).toHaveBeenCalledWith(phase, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      it('should do stuff', done => {
        let branch = input.branch;
        let tempBranch = merger._tempBranch;
        let checkoutBranchTask = merger._cleanUpTasks.checkoutBranch;
        let cleanUntrackedTask = merger._cleanUpTasks.cleanUntracked;
        let deleteTempBranchTask = merger._cleanUpTasks.deleteTempBranch;
        let prUrl = Merger.getPrUrl(input.repo, input.prNo);

        doWork().
          then(() => {
            expect(gitUtils.checkout).toHaveBeenCalledWith(branch);
            expect(cleanUper.schedule.calls.argsFor(0)[0]).toBe(cleanUntrackedTask);
            expect(gitUtils.pull).toHaveBeenCalledWith(branch, true);
            expect(gitUtils.createBranch).toHaveBeenCalledWith(tempBranch);
            expect(cleanUper.schedule.calls.argsFor(1)[0]).toBe(deleteTempBranchTask);
            expect(cleanUper.schedule.calls.argsFor(2)[0]).toBe(checkoutBranchTask);
            expect(gitUtils.mergePullRequest).toHaveBeenCalledWith(prUrl);
          }).
          then(done, done.fail);
      });

      it('should schedule clean-up tasks at appropriate times', done => {
        let checkoutBranchTask = merger._cleanUpTasks.checkoutBranch;
        let cleanUntrackedTask = merger._cleanUpTasks.cleanUntracked;
        let deleteTempBranchTask = merger._cleanUpTasks.deleteTempBranch;

        gitUtils.mergePullRequest.and.callFake(() => {
          expect(gitUtils.pull).toHaveBeenCalled();

          expect(cleanUper.schedule.calls.argsFor(1)[0]).toBe(deleteTempBranchTask);
          expect(cleanUper.schedule.calls.argsFor(2)[0]).toBe(checkoutBranchTask);
          expect(cleanUper.unschedule).not.toHaveBeenCalled();

          done();
        });
        gitUtils.pull.and.callFake(() => {
          expect(cleanUper.schedule.calls.argsFor(0)[0]).toBe(cleanUntrackedTask);
          expect(cleanUper.unschedule).not.toHaveBeenCalled();
        });

        expect(cleanUper.schedule).not.toHaveBeenCalledWith();

        doWork();
      });

      it('should leave the clean-up tasks scheduled after completion', done => {
        doWork().
          then(() => {
            expect(cleanUper.schedule).toHaveBeenCalled();
            expect(cleanUper.unschedule).not.toHaveBeenCalled();
          }).
          then(done, done.fail);
      });
    });

    describe('#phase3()', () => {
      let promise;

      beforeEach(() => {
        spyOn(cleanUper, 'schedule'),
        spyOn(cleanUper, 'unschedule'),
        spyOn(gitUtils, 'checkout'),
        spyOn(gitUtils, 'countCommitsSince'),
        spyOn(gitUtils, 'deleteBranch'),
        spyOn(gitUtils, 'rebase'),
        spyOn(gitUtils, 'updateLastCommitMessage');

        promise = merger.phase3();
      });

      it('should call `uiUtils.phase()` (and return the returned value)', () => {
        let phase = jasmine.objectContaining({id: '3'});

        expect(uiUtils.phase).toHaveBeenCalledWith(phase, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      [1, 2].forEach(commitCount => {
        it(`should do stuff (commitCount: ${commitCount})`, done => {
          let branch = input.branch;
          let tempBranch = merger._tempBranch;
          let abortRebaseTask = merger._cleanUpTasks.abortRebase;
          let checkoutBranchTask = merger._cleanUpTasks.checkoutBranch;
          let deleteTempBranchTask = merger._cleanUpTasks.deleteTempBranch;
          let hardResetTask = merger._cleanUpTasks.hardReset;

          spyOn(merger, '_getNewMessage');

          gitUtils.countCommitsSince.and.returnValue(commitCount);
          gitUtils.updateLastCommitMessage.and.callFake(getNewMessage => getNewMessage());

          doWork().
            then(() => {
              let mustRebaseMerged = commitCount > 1;
              let expectedRebaseCount = mustRebaseMerged ? 2 : 1;
              let s = -1;   // `schedule()` call index
              let u = -1;   // `unschedule()` call index

              expect(gitUtils.countCommitsSince).toHaveBeenCalledWith(branch),
              expect(gitUtils.checkout).toHaveBeenCalledWith(branch),
              expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(checkoutBranchTask);
              expect(cleanUper.schedule.calls.argsFor(++s)[0]).toBe(abortRebaseTask);
              expect(gitUtils.rebase).toHaveBeenCalledWith(tempBranch);
              expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(abortRebaseTask);
              expect(cleanUper.schedule.calls.argsFor(++s)[0]).toBe(hardResetTask);
              expect(gitUtils.deleteBranch).toHaveBeenCalledWith(tempBranch, true),
              expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(deleteTempBranchTask);
              if (mustRebaseMerged) {
                expect(cleanUper.schedule.calls.argsFor(++s)[0]).toBe(abortRebaseTask);
                expect(gitUtils.rebase).toHaveBeenCalledWith(commitCount, true);
                expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(abortRebaseTask);
              }
              expect(gitUtils.updateLastCommitMessage).toHaveBeenCalledWith(jasmine.any(Function));
              expect(merger._getNewMessage).toHaveBeenCalled();
              expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(hardResetTask);

              expect(gitUtils.rebase.calls.count()).toBe(expectedRebaseCount);
            }).
            then(done, done.fail);
        });
      });

      it('should schedule clean-up task before calling `gitUtils.rebase()`', done => {
        let abortRebaseTask = merger._cleanUpTasks.abortRebase;

        cleanUper.schedule.and.callFake(() => cleanUper.unschedule.calls.reset());
        gitUtils.countCommitsSince.and.returnValue(42);
        gitUtils.rebase.and.callFake(() => {
          expect(cleanUper.schedule.calls.mostRecent().args[0]).toBe(abortRebaseTask);
          if (cleanUper.unschedule.calls.any()) {
            expect(cleanUper.unschedule.calls.mostRecent().args[0]).not.toBe(abortRebaseTask);
          }
        });

        doWork().
          then(() => expect(gitUtils.rebase).toHaveBeenCalled()).
          then(done, done.fail);
      });

      it('should wrap certain operations in a `hardReset` clean-up task', done => {
        let hardResetTask = merger._cleanUpTasks.hardReset;

        cleanUper.schedule.and.callFake(() => cleanUper.unschedule.calls.reset());
        gitUtils.deleteBranch.and.callFake(() => {
          expect(cleanUper.schedule.calls.mostRecent().args[0]).toBe(hardResetTask);
          if (cleanUper.unschedule.calls.any()) {
            expect(cleanUper.unschedule.calls.mostRecent().args[0]).not.toBe(hardResetTask);
          }
        });

        doWork().
          then(() => expect(gitUtils.deleteBranch).toHaveBeenCalled()).
          then(() => expect(cleanUper.unschedule.calls.mostRecent().args[0]).toBe(hardResetTask)).
          then(done, done.fail);
      });
    });

    describe('#phase4()', () => {
      let promise;

      beforeEach(() => {
        spyOn(logger, 'log');
        spyOn(utils, 'waitAsPromised');
        spyOn(gitUtils, 'diffWithHighlight');
        spyOn(gitUtils, 'log');

        promise = merger.phase4();
      });

      it('should call `uiUtils.phase()` (and return the returned value)', () => {
        let phase = jasmine.objectContaining({id: '4'});

        expect(uiUtils.phase).toHaveBeenCalledWith(phase, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      it('should do stuff', done => {
        let branch = input.branch;

        doWork().
          then(() => {
            expect(gitUtils.diffWithHighlight).toHaveBeenCalledWith(`origin/${branch}`);
            expect(gitUtils.log).toHaveBeenCalledWith();
          }).
          then(done, done.fail);
      });
    });

    describe('#phase5()', () => {
      let promise;

      beforeEach(() => {
        spyOn(logger, 'log');
        spyOn(cleanUper, 'unschedule');
        spyOn(gitUtils, 'clean');

        promise = merger.phase5();
      });

      it('should call `uiUtils.phase()` (and return the returned value)', () => {
        let phase = jasmine.objectContaining({id: '5'});

        expect(uiUtils.phase).toHaveBeenCalledWith(phase, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      it('should do stuff', done => {
        let cleanUntrackedTask = merger._cleanUpTasks.cleanUntracked;

        doWork().
          then(() => {
            expect(gitUtils.clean).toHaveBeenCalledWith();
            expect(cleanUper.unschedule).toHaveBeenCalled();
            expect(cleanUper.unschedule.calls.argsFor(0)[0]).toBe(cleanUntrackedTask);
          }).
          then(done, done.fail);
      });
    });

    describe('#phase6()', () => {
      let promise;

      beforeEach(() => {
        spyOn(logger, 'log');
        spyOn(uiUtils, 'askYesOrNoQuestion');
        spyOn(utils, 'spawnAsPromised');

        promise = merger.phase6();
      });

      it('should call `uiUtils.phase()` (and return the returned value)', () => {
        let phase = jasmine.objectContaining({id: '6'});

        expect(uiUtils.phase).toHaveBeenCalledWith(phase, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      it('should ask confirmation before running the CI checks', done => {
        uiUtils.askYesOrNoQuestion.and.callFake(() => {
          expect(logger.log).not.toHaveBeenCalled();
          expect(utils.spawnAsPromised).not.toHaveBeenCalled();

          return Promise.reject();
        });

        doWork().
          then(() => expect(uiUtils.askYesOrNoQuestion).toHaveBeenCalled()).
          then(done, done.fail);
      });

      it('should resolve the returned promise even if the user does not confirm', done => {
        uiUtils.askYesOrNoQuestion.and.returnValue(Promise.reject());

        doWork().then(done, done.fail);
      });

      it('should do nothing if the user does not confirm', done => {
        uiUtils.askYesOrNoQuestion.and.returnValue(Promise.reject());

        doWork().
          then(() => {
            expect(logger.log).not.toHaveBeenCalled();
            expect(utils.spawnAsPromised).not.toHaveBeenCalled();
          }).
          then(done, done.fail);
      });

      it('should run the CI checks if the user confirms', done => {
        spyOn(process, 'cwd').and.returnValue('foo/bar');
        uiUtils.askYesOrNoQuestion.and.returnValue(Promise.resolve());

        let ciChecksCmdRe =
            /"[^"]*node[^"]*"\s+"[^"]*foo.+bar.+node_modules.+grunt.+bin.+grunt"\s+ci-checks/;

        doWork().
          then(() => {
            expect(logger.log).toHaveBeenCalled();
            expect(utils.spawnAsPromised).toHaveBeenCalled();
            expect(utils.spawnAsPromised.calls.argsFor(0)[0]).toMatch(ciChecksCmdRe);
          }).
          then(done, done.fail);
      });
    });

    describe('#phase7()', () => {
      let promise;

      beforeEach(() => {
        spyOn(gitUtils, 'push').and.returnValue(Promise.resolve());
        spyOn(uiUtils, 'askYesOrNoQuestion');

        promise = merger.phase7();
      });

      it('should call `uiUtils.phase()` (and return the returned value)', () => {
        let phase = jasmine.objectContaining({id: '7'});

        expect(uiUtils.phase).toHaveBeenCalledWith(phase, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      it('should ask confirmation before pushing to origin', done => {
        uiUtils.askYesOrNoQuestion.and.callFake(() => {
          expect(gitUtils.push).not.toHaveBeenCalled();

          return Promise.reject();
        });

        doWork().
          then(() => expect(uiUtils.askYesOrNoQuestion).toHaveBeenCalled()).
          then(done, done.fail);
      });

      it('should resolve the returned promise with `true` if the user confirms', done => {
        uiUtils.askYesOrNoQuestion.and.returnValue(Promise.resolve());

        doWork().
          then(value => expect(value).toBe(true)).
          then(done, done.fail);
      });

      it('should resolve the returned promise with `false` if the user does not confirm', done => {
        uiUtils.askYesOrNoQuestion.and.returnValue(Promise.reject());

        doWork().
          then(value => expect(value).toBe(false)).
          then(done, done.fail);
      });

      it('should do nothing if the user does not confirm', done => {
        uiUtils.askYesOrNoQuestion.and.returnValue(Promise.reject());

        doWork().
          then(() => expect(uiUtils.askYesOrNoQuestion).toHaveBeenCalled()).
          then(() => expect(gitUtils.push).not.toHaveBeenCalled()).
          then(done, done.fail);
      });

      it('should push to origin if the user confirms', done => {
        let branch = input.branch;

        uiUtils.askYesOrNoQuestion.and.returnValue(Promise.resolve());

        doWork().
          then(() => expect(uiUtils.askYesOrNoQuestion).toHaveBeenCalled()).
          then(() => expect(gitUtils.push).toHaveBeenCalledWith(branch)).
          then(done, done.fail);
      });
    });
  });

  // Helpers
  function createMerger(input) {
    return new Merger(logger, cleanUper, utils, uiUtils, gitUtils, input);
  }
});
