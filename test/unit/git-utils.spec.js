'use strict';

// Imports
let https = require('https');
let stream = require('stream');

// Imports - Local
let CleanUper = require('../../lib/clean-uper');
let Config = require('../../lib/config');
let GitUtils = require('../../lib/git-utils');
let Utils = require('../../lib/utils');

// Tests
describe('GitUtils', () => {
  let cleanUper;
  let config;
  let utils;
  let deferred;

  beforeEach(() => {
    cleanUper = new CleanUper();
    config = new Config();
    utils = new Utils(cleanUper, config.messages);

    deferred = {};
    ['execAsPromised', 'spawnAsPromised'].forEach(methodName => {
      let cb = () => new Promise((resolve, reject) => deferred = {resolve, reject});
      spyOn(utils, methodName).and.callFake(cb);
    });
  });

  describe('#constructor()', () => {
    it('should register an `abortAm` clean-up task', () => {
      spyOn(cleanUper, 'registerTask');
      createGitUtils();

      expect(cleanUper.registerTask).toHaveBeenCalled();
      expect(cleanUper.registerTask.calls.argsFor(0)[0]).toContain('git am');
    });
  });

  describe('#abortAm()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('abortAm');
    });

    it('should call `git am --abort`', () => {
      expectToCall('abortAm', 'git am --abort');
    });
  });

  describe('#abortRebase()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('abortRebase');
    });

    it('should call `git rebase --abort`', () => {
      expectToCall('abortRebase', 'git rebase --abort');
    });
  });

  describe('#checkout()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('checkout', ['foo']);
    });

    it('should call `git checkout <branch>`', () => {
      expectToCall('checkout', ['foo'], 'git checkout foo');
    });
  });

  describe('#countCommitsSince()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('countCommitsSince', ['foo']);
    });

    it('should call `git rev-list --count <commit>..HEAD`', () => {
      expectToCall('countCommitsSince', ['foo'], 'git rev-list --count foo..HEAD');
    });

    it('should convert the resolved value to a number', done => {
      let gUtils = createGitUtils();
      gUtils.countCommitsSince('foo').then(count => {
        expect(count).toBe(42);

        done();
      });

      deferred.resolve(' 42\n ');
    });
  });

  describe('#createBranch()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('createBranch', ['foo']);
    });

    it('should call `git checkout -b <branch>`', () => {
      expectToCall('createBranch', ['foo'], 'git checkout -b foo');
    });
  });

  describe('#deleteBranch()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('deleteBranch', ['foo']);
    });

    it('should call `git branch --delete [--force] <branch>`', () => {
      expectToCall('deleteBranch', ['foo'], 'git branch --delete foo');
      expectToCall('deleteBranch', ['foo', false], 'git branch --delete foo');
      expectToCall('deleteBranch', ['foo', true], 'git branch --delete --force foo');
    });
  });

  describe('#diff()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('diff', ['foo']);
    });

    it('should call `git diff <commit>`', () => {
      expectToCall('diff', ['foo'], 'git diff foo');
    });
  });

  describe('#getCommitMessage()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('getCommitMessage', ['foo']);
    });

    it('should call `git show --no-patch --format=%B <commit>`', () => {
      expectToCall('getCommitMessage', ['foo'], 'git show --no-patch --format=%B foo');
    });

    it('should convert the resolved value to string', done => {
      let gUtils = createGitUtils();
      gUtils.getCommitMessage('foo').then(message => {
        expect(message).toBe('bar');

        done();
      });

      deferred.resolve({toString: () => 'bar'});
    });
  });

  describe('#getLastCommitMessage()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('getLastCommitMessage');
    });

    it('should call `git show --no-patch --format=%B HEAD`', () => {
      expectToCall('getLastCommitMessage', 'git show --no-patch --format=%B HEAD');
    });

    it('should convert the resolved value to string', done => {
      let gUtils = createGitUtils();
      gUtils.getLastCommitMessage().then(message => {
        expect(message).toBe('bar');

        done();
      });

      deferred.resolve({toString: () => 'bar'});
    });
  });

  describe('#log()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('log');
    });

    it('should call `git log [--oneline] [-<count>]`', () => {
      expectToCall('log', [], 'git log');
      expectToCall('log', [null, null], 'git log');
      expectToCall('log', [false, false], 'git log');

      expectToCall('log', [true], 'git log --oneline');
      expectToCall('log', [true, null], 'git log --oneline');
      expectToCall('log', [true, false], 'git log --oneline');
      expectToCall('log', [true, 0], 'git log --oneline');

      expectToCall('log', [null, 42], 'git log -42');
      expectToCall('log', [false, 42], 'git log -42');

      expectToCall('log', [true, 42], 'git log --oneline -42');
    });

    it('should ignore rejections', done => {
      let gUtils = createGitUtils();
      gUtils.log().then(done);

      deferred.reject();
    });
  });

  describe('#mergePullRequest()', () => {
    let PassThrough = stream.PassThrough;
    let gUtils;
    let request;
    let response;

    beforeEach(() => {
      gUtils = createGitUtils();
      request = new PassThrough();
      response = new PassThrough();

      spyOn(https, 'get').and.callFake((_, cb) => {
        request.on('end', () => cb(response));
        return request;
      });
    });

    it('should return a promise', () => {
      expectToReturnPromise('mergePullRequest', ['foo']);
    });

    it('should request the specified URL', () => {
      gUtils.mergePullRequest('foo');

      expect(https.get).toHaveBeenCalledWith('foo', jasmine.any(Function));
    });

    it('should reject the returned promise on request error', done => {
      gUtils.mergePullRequest('foo').catch(err => {
        expect(err).toBe('Test');

        done();
      });

      request.emit('error', 'Test');
    });

    it('should call `git am -3` with the response as input stream', done => {
      gUtils.mergePullRequest('foo');
      request.emit('end');

      setTimeout(() => {
        expect(utils.spawnAsPromised).toHaveBeenCalledWith('git am -3', response);

        done();
      });
    });

    it('should wrap the command call in a clean-up task', done => {
      spyOn(cleanUper, 'withTask').and.callFake((taskId, cb) => {
        expect(taskId).toBe(gUtils._cleanUpTasks.abortAm);
        expect(cb).toEqual(jasmine.any(Function));
        expect(utils.spawnAsPromised).not.toHaveBeenCalled();

        cb();

        expect(utils.spawnAsPromised).toHaveBeenCalled();

        return Promise.resolve();
      });

      gUtils.mergePullRequest('foo');
      request.emit('end');

      setTimeout(() => {
        expect(cleanUper.withTask).toHaveBeenCalled();

        done();
      });
    });

    it('should resolve the returned promise on success', done => {
      utils.spawnAsPromised.and.returnValue(Promise.resolve('Test'));

      gUtils.mergePullRequest('foo').then(value => {
        expect(value).toBe('Test');

        done();
      });

      request.emit('end');
    });

    it('should reject the returned promise on error', done => {
      utils.spawnAsPromised.and.returnValue(Promise.reject('Test'));

      gUtils.mergePullRequest('foo').catch(err => {
        expect(err).toBe('Test');

        done();
      });

      request.emit('end');
    });
  });

  describe('#pull()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('pull', ['foo']);
    });

    it('should call `git pull [--rebase] origin <branch>`', () => {
      expectToCall('pull', ['foo'], 'git pull origin foo');
      expectToCall('pull', ['foo', false], 'git pull origin foo');
      expectToCall('pull', ['foo', true], 'git pull --rebase origin foo');
    });
  });

  describe('#push()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('push', ['foo']);
    });

    it('should call `git push origin <branch>`', () => {
      expectToCall('push', ['foo'], 'git push origin foo');
    });
  });

  describe('#rebase()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('rebase', ['foo']);
    });

    it('should call `git rebase [--interactive] <commit>`', () => {
      expectToCall('rebase', ['foo'], 'git rebase foo');
      expectToCall('rebase', ['foo', false], 'git rebase foo');
      expectToCall('rebase', ['foo', true], 'git rebase --interactive foo');
    });

    it('should use `HEAD~<commit>` if `commit` is a number', () => {
      expectToCall('rebase', [42], 'git rebase HEAD~42');
      expectToCall('rebase', [42, false], 'git rebase HEAD~42');
      expectToCall('rebase', [42, true], 'git rebase --interactive HEAD~42');
    });
  });

  describe('#reset()', () => {
    it('should return a promise', () => {
      expectToReturnPromise('reset', ['foo']);
    });

    it('should call `git reset [--hard] <commit>`', () => {
      expectToCall('reset', ['foo'], 'git reset foo');
      expectToCall('reset', ['foo', false], 'git reset foo');
      expectToCall('reset', ['foo', true], 'git reset --hard foo');
    });
  });

  describe('#setLastCommitMessage()', () => {
    let gUtils;

    beforeEach(() => {
      gUtils = createGitUtils();

      spyOn(utils, 'unlinkAsPromised').and.returnValue(Promise.resolve());
      spyOn(utils, 'writeFileAsPromised').and.returnValue(Promise.resolve());
    });

    it('should return a promise', done => {
      let promise = gUtils.setLastCommitMessage('foo').then(done);
      setTimeout(() => deferred.reject());

      expect(promise).toEqual(jasmine.any(Promise));
    });

    it('should write the message to a temporary file', done => {
      gUtils.setLastCommitMessage('foo').then(() => {
        expect(utils.writeFileAsPromised).toHaveBeenCalledWith(jasmine.any(String), 'foo');

        done();
      });

      setTimeout(() => deferred.resolve());
    });

    it('should call `git commit --amend --file=<temp-file>`', done => {
      gUtils.setLastCommitMessage('foo').then(() => {
        let tempFile = utils.writeFileAsPromised.calls.argsFor(0)[0];

        expect(utils.spawnAsPromised).toHaveBeenCalledWith(`git commit --amend --file=${tempFile}`);

        done();
      });

      setTimeout(() => deferred.resolve());
    });

    it('should remove the temporary file on success', done => {
      gUtils.setLastCommitMessage('foo').then(() => {
        let tempFile = utils.writeFileAsPromised.calls.argsFor(0)[0];

        expect(utils.unlinkAsPromised).toHaveBeenCalledWith(tempFile);

        done();
      });

      setTimeout(() => deferred.resolve());
    });

    it('should remove the temporary file on error', done => {
      gUtils.setLastCommitMessage('foo').then(() => {
        let tempFile = utils.writeFileAsPromised.calls.argsFor(0)[0];

        expect(utils.unlinkAsPromised).toHaveBeenCalledWith(tempFile);

        done();
      });

      setTimeout(() => deferred.reject());
    });
  });

  describe('#updateLastCommitMessage()', () => {
    let gUtils;

    beforeEach(() => {
      gUtils = createGitUtils();

      spyOn(gUtils, 'getLastCommitMessage').and.returnValue(Promise.resolve('foo'));
      spyOn(gUtils, 'setLastCommitMessage');
    });

    it('should return a promise', () => {
      expectToReturnPromise('updateLastCommitMessage', [() => {}]);
    });

    it('should retrieve the old commit message', done => {
      let getNewMessage = () => {};

      gUtils.updateLastCommitMessage(getNewMessage).then(() => {
        expect(gUtils.getLastCommitMessage).toHaveBeenCalled();

        done();
      });
    });

    it('should pass the old commit message to `getNewMessage()`', done => {
      let getNewMessage = jasmine.createSpy('getNewMessage');

      gUtils.updateLastCommitMessage(getNewMessage).then(() => {
        expect(getNewMessage).toHaveBeenCalledWith('foo');

        done();
      });
    });

    it('should update the commit message to the value returned by `getNewMessage()`', done => {
      let getNewMessage = () => 'bar';

      gUtils.updateLastCommitMessage(getNewMessage).then(() => {
        expect(gUtils.setLastCommitMessage).toHaveBeenCalledWith('bar');

        done();
      });
    });
  });

  // Helpers
  function createGitUtils() {
    return new GitUtils(cleanUper, utils);
  }

  function expectToCall(methodName, args, command) {
    if (command === undefined) {
      command = args;
      args = [];
    }

    let gUtils = createGitUtils();
    gUtils[methodName].apply(gUtils, args);

    let method = utils.execAsPromised.calls.count() ?
        utils.execAsPromised :
        utils.spawnAsPromised;

    expect(method).toHaveBeenCalledWith(command);
  }

  function expectToReturnPromise(methodName, args) {
    let gUtils = createGitUtils();
    let promise = gUtils[methodName].apply(gUtils, args);

    expect(promise).toEqual(jasmine.any(Promise));
  }
});
