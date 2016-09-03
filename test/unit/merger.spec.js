'use strict';

// Imports
let ClaChecker = require('@gkalpak/ng-cla-check');

// Imports - Local
let CleanUper = require('../../lib/clean-uper');
let GitUtils = require('../../lib/git-utils');
let Merger = require('../../lib/merger');
let Utils = require('../../lib/utils');

// Tests
describe('Merger', () => {
  let cleanUper;
  let gUtils;
  let utils;

  beforeEach(() => {
    cleanUper = new CleanUper();
    utils = new Utils(cleanUper, {});
    gUtils = new GitUtils(cleanUper, utils);
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
    it('should accept `cleanUper`, `utils`, `gUtils` and `input` arguments', () => {
      let input = {};
      let merger = createMerger(input);

      expect(merger._cleanUper).toBe(cleanUper);
      expect(merger._utils).toBe(utils);
      expect(merger._gUtils).toBe(gUtils);
      expect(merger._input).toBe(input);
    });

    it('should create a `_tempBranch` property', () => {
      spyOn(Merger, 'getTempBranch').and.returnValue('foo');
      let merger = createMerger({});

      expect(merger._tempBranch).toBe('foo');
    });

    it('should create a `_claChecker` property (ClaChecker)', () => {
      let merger = createMerger({});

      expect(merger._claChecker).toEqual(jasmine.any(ClaChecker));
    });

    it('should register clean-up tasks', () => {
      spyOn(cleanUper, 'registerTask');
      createMerger({});

      expect(cleanUper.registerTask).toHaveBeenCalled();
    });
  });

  describe('#merge()', () => {
    let phaseNums = [1, 2, 3, 4, 5, 6];
    let merger;

    beforeEach(() => {
      merger = createMerger({repo: 'foo/bar', branch: 'baz-qux', prNo: 12345});

      phaseNums.forEach(num => {
        let methodName = `phase${num}`;
        spyOn(merger, methodName).and.returnValue(Promise.resolve(methodName));
      });
    });

    it('should return a promise', done => {
      let promise = merger.merge().then(done);

      expect(promise).toEqual(jasmine.any(Promise));
    });

    it('should run all phases (and resolve the returned promise)', done => {
      let lastNum = phaseNums[phaseNums.length - 1];

      merger.merge().
        then(value => {
          expect(value).toBe(`phase${lastNum}`);
          phaseNums.forEach(num => {
            expect(merger[`phase${num}`]).toHaveBeenCalled();
          });
        }).
        then(done);
    });

    it('should abort (and reject the returned promise) if any phase errors', done => {
      let errorNum = 4;
      merger[`phase${errorNum}`].and.returnValue(Promise.reject('Test'));

      merger.merge().
        catch(err => {
          expect(err).toBe('Test');
          phaseNums.forEach(num => {
            let method = merger[`phase${num}`];

            if (num > errorNum) {
              expect(method).not.toHaveBeenCalled();
            } else {
              expect(method).toHaveBeenCalled();
            }
          });
        }).
        then(done);
    });
  });

  describe('phases', () => {
    let input;
    let merger;
    let doWork;
    let returnedPromise;

    beforeEach(() => {
      input = {repo: 'foo/bar', branch: 'baz-qux', prNo: 12345};
      merger = createMerger(input);
      doWork = null;
      returnedPromise = null;

      spyOn(utils, 'phase').and.callFake((_, cb) => {
        doWork = cb;
        returnedPromise = new Promise(() => {});

        return returnedPromise;
      });
    });

    describe('#phase1()', () => {
      it('should call `utils.phase()` (and return the returned value)', () => {
        let value = merger.phase1();

        expect(utils.phase).toHaveBeenCalledWith(1, jasmine.any(Function));
        expect(value).toBe(returnedPromise);
      });

      it('should check the CLA signature', () => {
        spyOn(merger._claChecker, 'check').and.returnValue(Promise.resolve());

        merger.phase1();
        doWork();

        expect(merger._claChecker.check).toHaveBeenCalledWith(12345);
      });

      it('should ask confirmation if the CLA signature check fails', done => {
        spyOn(utils, 'askYesOrNoQuestion');
        spyOn(merger._claChecker, 'check').and.returnValue(Promise.reject());

        merger.phase1();
        doWork();

        setTimeout(() => {
          expect(utils.askYesOrNoQuestion).toHaveBeenCalled();

          done();
        });
      });
    });

    describe('#phase2()', () => {
      let promise;

      beforeEach(() => {
        spyOn(cleanUper, 'schedule');
        spyOn(cleanUper, 'unschedule');
        spyOn(gUtils, 'checkout');
        spyOn(gUtils, 'createBranch');
        spyOn(gUtils, 'mergePullRequest');
        spyOn(gUtils, 'pull');

        promise = merger.phase2();
      });

      it('should call `utils.phase()` (and return the returned value)', () => {
        expect(utils.phase).toHaveBeenCalledWith(2, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      it('should do stuff', done => {
        let branch = input.branch;
        let tempBranch = merger._tempBranch;
        let checkoutBranchTask = merger._cleanUpTasks.checkoutBranch;
        let deleteTempBranchTask = merger._cleanUpTasks.deleteTempBranch;
        let prUrl = Merger.getPrUrl(input.repo, input.prNo);

        doWork().
          then(() => {
            expect(gUtils.checkout).toHaveBeenCalledWith(branch);
            expect(gUtils.pull).toHaveBeenCalledWith(branch, true);
            expect(gUtils.createBranch).toHaveBeenCalledWith(tempBranch);
            expect(cleanUper.schedule.calls.argsFor(0)[0]).toBe(deleteTempBranchTask);
            expect(cleanUper.schedule.calls.argsFor(1)[0]).toBe(checkoutBranchTask);
            expect(gUtils.mergePullRequest).toHaveBeenCalledWith(prUrl);
          }).
          then(done);
      });

      it('should schedule clean-up tasks before calling `gUtils.mergePullRequest()`', done => {
        let checkoutBranchTask = merger._cleanUpTasks.checkoutBranch;
        let deleteTempBranchTask = merger._cleanUpTasks.deleteTempBranch;

        gUtils.mergePullRequest.and.callFake(() => {
          expect(cleanUper.schedule.calls.argsFor(0)[0]).toBe(deleteTempBranchTask);
          expect(cleanUper.schedule.calls.argsFor(1)[0]).toBe(checkoutBranchTask);
          expect(cleanUper.unschedule).not.toHaveBeenCalled();

          done();
        });

        expect(cleanUper.schedule).not.toHaveBeenCalledWith();

        doWork();
      });

      it('should schedule leave the clean-up tasks scheduled after completion', done => {
        doWork().
          then(() => {
            expect(cleanUper.schedule).toHaveBeenCalled();
            expect(cleanUper.unschedule).not.toHaveBeenCalled();
          }).
          then(done);
      });
    });

    describe('#phase3()', () => {
      let promise;

      beforeEach(() => {
        spyOn(cleanUper, 'schedule'),
        spyOn(cleanUper, 'unschedule'),
        spyOn(gUtils, 'checkout'),
        spyOn(gUtils, 'countCommitsSince'),
        spyOn(gUtils, 'deleteBranch'),
        spyOn(gUtils, 'rebase'),
        spyOn(gUtils, 'updateLastCommitMessage');

        promise = merger.phase3();
      });

      it('should call `utils.phase()` (and return the returned value)', () => {
        expect(utils.phase).toHaveBeenCalledWith(3, jasmine.any(Function));
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

          gUtils.countCommitsSince.and.returnValue(commitCount);

          doWork().
            then(() => {
              let mustRebaseMerged = commitCount > 1;
              let expectedRebaseCount = mustRebaseMerged ? 2 : 1;
              let s = -1;   // `schedule()` call index
              let u = -1;   // `unschedule()` call index

              expect(gUtils.countCommitsSince).toHaveBeenCalledWith(branch),
              expect(gUtils.checkout).toHaveBeenCalledWith(branch),
              expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(checkoutBranchTask);
              expect(cleanUper.schedule.calls.argsFor(++s)[0]).toBe(abortRebaseTask);
              expect(gUtils.rebase).toHaveBeenCalledWith(tempBranch);
              expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(abortRebaseTask);
              expect(cleanUper.schedule.calls.argsFor(++s)[0]).toBe(hardResetTask);
              expect(gUtils.deleteBranch).toHaveBeenCalledWith(tempBranch, true),
              expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(deleteTempBranchTask);
              if (mustRebaseMerged) {
                expect(cleanUper.schedule.calls.argsFor(++s)[0]).toBe(abortRebaseTask);
                expect(gUtils.rebase).toHaveBeenCalledWith(commitCount, true);
                expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(abortRebaseTask);
              }
              expect(gUtils.updateLastCommitMessage).toHaveBeenCalledWith(jasmine.any(Function));
              expect(cleanUper.unschedule.calls.argsFor(++u)[0]).toBe(hardResetTask);

              expect(gUtils.rebase.calls.count()).toBe(expectedRebaseCount);
            }).
            then(done);
        });
      });

      it('should schedule clean-up task before calling `gUtils.rebase()`', done => {
        let abortRebaseTask = merger._cleanUpTasks.abortRebase;

        cleanUper.schedule.and.callFake(() => cleanUper.unschedule.calls.reset());
        gUtils.countCommitsSince.and.returnValue(42);
        gUtils.rebase.and.callFake(() => {
          expect(cleanUper.schedule.calls.mostRecent().args[0]).toBe(abortRebaseTask);
          if (cleanUper.unschedule.calls.any()) {
            expect(cleanUper.unschedule.calls.mostRecent().args[0]).not.toBe(abortRebaseTask);
          }
        });

        doWork().then(done);
      });

      it('should wrap certain operations in a `hardReset` clean-up task', done => {
        let hardResetTask = merger._cleanUpTasks.hardReset;

        cleanUper.schedule.and.callFake(() => cleanUper.unschedule.calls.reset());
        gUtils.deleteBranch.and.callFake(() => {
          expect(cleanUper.schedule.calls.mostRecent().args[0]).toBe(hardResetTask);
          if (cleanUper.unschedule.calls.any()) {
            expect(cleanUper.unschedule.calls.mostRecent().args[0]).not.toBe(hardResetTask);
          }
        });

        doWork().
          then(() => expect(cleanUper.unschedule.calls.mostRecent().args[0]).toBe(hardResetTask)).
          then(done);
      });
    });

    describe('#phase4()', () => {
      let promise;

      beforeEach(() => {
        spyOn(console, 'log');
        spyOn(utils, 'waitAsPromised');
        spyOn(gUtils, 'diff');
        spyOn(gUtils, 'log');

        promise = merger.phase4();
      });

      it('should call `utils.phase()` (and return the returned value)', () => {
        expect(utils.phase).toHaveBeenCalledWith(4, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      it('should do stuff', done => {
        let branch = input.branch;

        doWork().
          then(() => {
            expect(gUtils.diff).toHaveBeenCalledWith(`origin/${branch}`);
            expect(gUtils.log).toHaveBeenCalled();
          }).
          then(done);
      });
    });

    describe('#phase5()', () => {
      let promise;

      beforeEach(() => {
        spyOn(console, 'log');
        spyOn(utils, 'askYesOrNoQuestion');
        spyOn(utils, 'getRunWithNodeCmd');
        spyOn(utils, 'spawnAsPromised');

        promise = merger.phase5();
      });

      it('should call `utils.phase()` (and return the returned value)', () => {
        expect(utils.phase).toHaveBeenCalledWith(5, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      it('should ask confirmation before running the CI checks', done => {
        utils.askYesOrNoQuestion.and.callFake(() => {
          expect(console.log).not.toHaveBeenCalled();
          expect(utils.spawnAsPromised).not.toHaveBeenCalled();

          return Promise.reject();
        });

        doWork().
          then(() => expect(utils.askYesOrNoQuestion).toHaveBeenCalled()).
          then(done);
      });

      it('should resolve the returned promise even if the user does not confirm', done => {
        utils.askYesOrNoQuestion.and.returnValue(Promise.reject());

        doWork().then(done);
      });

      it('should do nothing if the user does not confirm', done => {
        utils.askYesOrNoQuestion.and.returnValue(Promise.reject());

        doWork().
          then(() => {
            expect(console.log).not.toHaveBeenCalled();
            expect(utils.getRunWithNodeCmd).not.toHaveBeenCalled();
            expect(utils.spawnAsPromised).not.toHaveBeenCalled();
          }).
          then(done);
      });

      it('should run the CI checks if the user confirms', done => {
        utils.askYesOrNoQuestion.and.returnValue(Promise.resolve());
        utils.getRunWithNodeCmd.and.returnValue('foo');

        doWork().
          then(() => {
            expect(console.log).toHaveBeenCalled();
            expect(utils.getRunWithNodeCmd).toHaveBeenCalledWith('grunt', ['ci-checks']);
            expect(utils.spawnAsPromised).toHaveBeenCalledWith('foo');
          }).
          then(done);
      });
    });

    describe('#phase6()', () => {
      let promise;

      beforeEach(() => {
        spyOn(gUtils, 'push').and.returnValue(Promise.resolve());
        spyOn(utils, 'askYesOrNoQuestion');

        promise = merger.phase6();
      });

      it('should call `utils.phase()` (and return the returned value)', () => {
        expect(utils.phase).toHaveBeenCalledWith(6, jasmine.any(Function));
        expect(promise).toBe(returnedPromise);
      });

      it('should ask confirmation before pushing to origin', done => {
        utils.askYesOrNoQuestion.and.callFake(() => {
          expect(gUtils.push).not.toHaveBeenCalled();

          return Promise.reject();
        });

        doWork().
          then(() => expect(utils.askYesOrNoQuestion).toHaveBeenCalled()).
          then(done);
      });

      it('should resolve the returned promise with `true` if the user confirms', done => {
        utils.askYesOrNoQuestion.and.returnValue(Promise.resolve());

        doWork().
          then(value => expect(value).toBe(true)).
          then(done);
      });

      it('should resolve the returned promise with `false` if the user does not confirm', done => {
        utils.askYesOrNoQuestion.and.returnValue(Promise.reject());

        doWork().
          then(value => expect(value).toBe(false)).
          then(done);
      });

      it('should do nothing if the user does not confirm', done => {
        utils.askYesOrNoQuestion.and.returnValue(Promise.reject());

        doWork().
          then(() => expect(gUtils.push).not.toHaveBeenCalled()).
          then(done);
      });

      it('should push to origin if the user confirms', done => {
        let branch = input.branch;

        utils.askYesOrNoQuestion.and.returnValue(Promise.resolve());

        doWork().
          then(() => expect(gUtils.push).toHaveBeenCalledWith(branch)).
          then(done);
      });
    });
  });

  // Helpers
  function createMerger(input) {
    return new Merger(cleanUper, utils, gUtils, input);
  }
});
