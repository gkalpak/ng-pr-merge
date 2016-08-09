# ng-pr-merge

_Warning:_
_This is still an experimental tool._
_Use with caution and your own risk!_

## Description

A utility for rebase-merging AngularJS PRs into master.
Tasks performed:

1. Verify CLA signature.
2. Fetch PR as local branch.
3. Rebase and merge local branch into master.
4. Add `Closes #<PR>` to the commit message.
5. Display the resulting changes (via `git diff` and `git log`).
6. Run the CI-checks.
7. Clean up and push to origin.

## Usage

Using in the command-line:

```shell
ng-pr-merge 12345
```
