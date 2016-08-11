'use strict';

// Imports
let chalk = require('chalk');
let childProcess = require('child_process');
let fs = require('fs');
let readline = require('readline');

// Classes
class Utils {
  // Constructor
  constructor(errorMessages) {
    this.errorMessages = errorMessages;
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

      return (actualLc === expectedLc) || (actualLc[0] === expectedLc[0]);
    }
  }

  exitWithError(errCode) {
    let errMsg = this.errorMessages[errCode] || errCode || '<no error code>';

    return function onError(err) {
      if (err) {
        console.error(err);
      }
      console.error(chalk.red(`\n  ERROR: ${errMsg}\n\n  ${chalk.bold('OPERATION ABORTED!')}`));

      process.exit(1);
    };
  }

  getExecutable(name) {
    let suffix = this.isWindows() ? '.cmd' : '';

    return name + suffix;
  }

  isWindows() {
    return process.platform === 'win32';
  }

  phase(phaseNo, description, doWork) {
    console.log(chalk.cyan.bold(`\n\n  PHASE ${phaseNo} - ${description}...\n`));

    return doWork().
      then(output => {
        console.log(chalk.green('\n  ...done'));
        return output;
      }).
      catch(this.exitWithError(`ERROR_phase${phaseNo}`));
  }

  spawnAsPromised(cmd) {
    return new Promise((resolve, reject) => {
      let pipableCmdSpecs = parseCmd(cmd);

      pipableCmdSpecs.reduce((prevProc, cmdSpec, idx, arr) => {
        let isLast = idx === arr.length - 1;
        let options = {
          stdio: [
            prevProc ? prevProc.stdout : 'inherit',
            !isLast ? 'pipe' : 'inherit',
            'inherit'
          ]
        };

        return childProcess.spawn(cmdSpec.executable, cmdSpec.args, options).
          on('error', reject).
          on('exit', (code, signal) => {
            if (code !== 0) return reject(code || signal);
            if (isLast) return resolve();
          });
      }, null);
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
        filter(Boolean);

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
Utils.prototype.execAsPromised = asPromised(childProcess.exec, childProcess);
Utils.prototype.writeFileAsPromised = asPromised(fs.writeFile, fs);
Utils.prototype.unlinkAsPromised = asPromised(fs.unlink, fs);

// Functions - Definitions
function asPromised(fn, context) {
  return function doAsPromised() {
    return new Promise((resolve, reject) => {
      let cb = (err, out) => (err ? reject : resolve)(err || out);
      let args = Array.prototype.concat.call(arguments, cb);

      fn.apply(context, args);
    });
  };
}

// Exports
module.exports = Utils;
