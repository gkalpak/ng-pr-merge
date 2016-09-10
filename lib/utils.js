'use strict';

// Imports
let chalk = require('chalk');
let childProcess = require('child_process');
let fs = require('fs');
let path = require('path');
let readline = require('readline');

// Variables - Private
let slice = Array.prototype.slice.call.bind(Array.prototype.slice);

// Classes
class Utils {
  // Constructor
  constructor(cleanUper, messages) {
    this._cleanUper = cleanUper;
    this._messages = messages;

    this.execAsPromised = asPromised(childProcess.exec, childProcess);
    this.unlinkAsPromised = asPromised(fs.unlink, fs);
    this.writeFileAsPromised = asPromised(fs.writeFile, fs);
  }

  // Methods - Protected
  _removeSurroundingQuotesOne(value) {
    let match = /^"([^"]*)"$/.exec(value) || /^'([^']*)'$/.exec(value);

    return !match ? value : match[1];
  }

  // Methods - Public
  askQuestion(question) {
    return new Promise(resolve => {
      var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question(`${question}`, answer => {
        rl.close();
        resolve(answer);
      });
    });
  }

  askYesOrNoQuestion(question, defaultToYes) {
    return new Promise((resolve, reject) => {
      let optStyle = chalk.bgBlack.gray;
      let defStyle = chalk.white.bold;
      let answerOptions = optStyle(defaultToYes ? `[${defStyle('Y')}/n]` : `[y/${defStyle('N')}]`);

      this.askQuestion(`\n${question} ${answerOptions}: ` + chalk.bgWhite('')).then(answer => {
        let nonDefaultAnswer = defaultToYes ? 'no' : 'yes';
        let gaveNonDefaultAnswer = matchesAnswer(answer, nonDefaultAnswer);
        let yes = (!defaultToYes && gaveNonDefaultAnswer) ||
                  (defaultToYes && !gaveNonDefaultAnswer);

        (yes ? resolve : reject)();
      });
    });

    // Helpers
    function matchesAnswer(actual, expected) {
      let actualLc = actual.toLowerCase();
      let expectedLc = expected.toLowerCase();

      return (actualLc === expectedLc) || (actualLc === expectedLc[0]);
    }
  }

  exitWithError(errCode, skipCleanUp) {
    let self = this;

    return function onError(err) {
      let errMsg = self._messages.errors[errCode] || errCode || '<no error code>';
      let exit = () => process.exit(1);
      let onError = err => console.error(chalk.red('\nSomething went wrong:'), err);

      if (err) {
        console.error('\n', err);
      }
      console.error(chalk.red(`\n  ERROR: ${errMsg}\n\n  ${chalk.bold('OPERATION ABORTED!')}`));

      return (!skipCleanUp && self._cleanUper.hasTasks()) ?
          self.offerToCleanUp().catch(onError).then(exit) :
          exit();
    };
  }

  getRunWithNodeCmd(moduleName, args) {
    let nodeExecutable = process.execPath;
    let scriptFile = path.join('node_modules', moduleName, 'bin', moduleName);

    let cmd = `"${nodeExecutable}" "${scriptFile}"`;
    if (args && args.length) {
      cmd += ` ${args.join(' ')}`;
    }

    return cmd;
  }

  interpolate(text, data) {
    return text.replace(/\${([^}]*)}/g, (_, key) => data[key]);
  }

  offerToCleanUp() {
    let doCleanUp = () => {
      let doWork = () => this._cleanUper.cleanUp();
      return this.phase('X', doWork, true);
    };
    let dontCleanUp = () => Promise.resolve().
      then(() => console.log('\nOK, I\'m not doing anything. FYI, the pending tasks (afaik) are:')).
      then(() => this._cleanUper.cleanUp(true));

    return this.
      askYesOrNoQuestion(chalk.bgYellow.black(this._messages.offerToCleanUp)).
      then(doCleanUp, dontCleanUp);
  }

  phase(phaseId, doWork, skipCleanUp) {
    let description = this._messages.phases[phaseId].description;
    console.log(chalk.cyan.bold(`\n\n  PHASE ${phaseId} - ${description}...\n`));

    return doWork().
      then(output => {
        console.log(chalk.green('\n  ...done'));
        return output;
      }).
      catch(this.exitWithError(`ERROR_phase${phaseId}`, skipCleanUp));
  }

  removeSurroundingQuotes(obj) {
    Object.keys(obj).forEach(key => {
      let value = obj[key];

      if (typeof value === 'string') {
        obj[key] = this._removeSurroundingQuotesOne(value);
      }
    });

    return obj;
  }

  spawnAsPromised(cmd, inputStream) {
    let self = this;

    return new Promise((resolve, reject) => {
      let pipableCmdSpecs = parseCmd(cmd);

      pipableCmdSpecs.reduce((prevStdout, cmdSpec, idx, arr) => {
        let isLast = idx === arr.length - 1;
        let options = {
          stdio: [
            !prevStdout ? 'inherit' : 'pipe',
            isLast ? 'inherit' : 'pipe',
            'inherit'
          ]
        };

        let proc = childProcess.spawn(cmdSpec.executable, cmdSpec.args, options).
          on('error', reject).
          on('exit', (code, signal) => {
            if (code !== 0) return reject(code || signal);
            if (isLast) return resolve();
          });

        if (prevStdout) prevStdout.pipe(proc.stdin);

        return proc.stdout;
      }, inputStream);
    });

    // Helpers
    function parseCmd(cmd) {
      return cmd.
        split(' | ').
        map(parsePipableCmd);
    }

    function parsePipableCmd(pipableCmd) {
      let tokens = pipableCmd.
        split('"').
        reduce((arr, str, idx) => {
          let newTokens = (idx % 2) ? [`"${str}"`] : str.split(' ');
          let lastToken = arr[arr.length - 1];

          if (lastToken) arr[arr.length - 1] += newTokens.shift();

          return arr.concat(newTokens);
        }, []).
        filter(Boolean).
        map(token => self._removeSurroundingQuotesOne(token));

      return {
        executable: tokens.shift(),
        args: tokens
      };
    }
  }

  waitAsPromised(period) {
    return new Promise(resolve => setTimeout(resolve, period));
  }
}

// Functions - Definitions
function asPromised(fn, context) {
  return function doAsPromised() {
    return new Promise((resolve, reject) => {
      let cb = (err, out) => (err ? reject : resolve)(err || out);
      let args = slice(arguments).concat(cb);

      fn.apply(context, args);
    });
  };
}

// Exports
module.exports = Utils;
