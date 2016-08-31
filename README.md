# ng-pr-merge

_Warning:_
_This is still an experimental tool._
_Use at your own risk!_

## Description

A utility for rebase-merging AngularJS PRs into master.
Tasks performed:

1. Verify CLA signature.
2. Fetch PR as local branch.
3. Rebase and merge local branch into target branch (e.g. `master`).
4. Add `Closes #<PR>` to the commit message.
5. Display the resulting changes (via `git diff` and `git log`).
6. Run the CI-checks.
7. Push to origin.

## Usage

Using in the command-line:

```shell
# Show usage instructions
ng-pr-merge --usage

# Merge a PR
ng-pr-merge 12345
```

You can optionally specify the GitHub repo and/or branch to merge to (by default
`angular/angular.js` and `master` respectively):

```shell
# Use non-default repo and branch
ng-pr-merge 12345 --branch="some-branch" --repo="some-user/some-repo"
```

Finally, adding the `--instructions` argument, will display the commands that need to be run, but
not actually do anything. This is useful if you want to run the commands yourself:

```shell
# Only show instructions
ng-pr-merge 12345 --instructions [--branch="some-branch"] [--repo="some-user/some-repo"]
```
