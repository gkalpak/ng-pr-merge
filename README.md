# ng-pr-merge [![Build Status][build-status-image]][build-status]

_Warning:_
_This is still an experimental tool._
_Use at your own risk!_

## Description

A utility for rebase-merging (AngularJS-related) GitHub PRs.
Tasks performed:

1. Verify the CLA signature.
2. Fetch the PR as local branch.
3. Rebase and merge the local branch into the target branch (e.g. `master`).
4. Add `Closes #<PR>` to the commit message (at the right place).
5. Display the resulting changes for inspection (via `git diff` and `git log`).
   _(Experimental feature: Enhanced diff highlighting.)_
6. Interactively clean untracked files (e.g. auto-generated artifacts).
7. Run the CI-checks.
8. Push the changes to origin.
9. Clean everything up (e.g. if something goes wrong).

## Usage

Using in the command-line:

```shell
# Show version info
ng-pr-merge --version

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
ng-pr-merge 12345 [--branch="some-branch"] [--repo="some-user/some-repo"] --instructions
```

## Testing

The following test-types/modes are available:

- **Code-linting:** `npm run lint`
  _Lint JavaScript files using ESLint._

- **Unit tests:** `npm run test-unit`
  _Run all the unit tests once. These tests are quick and suitable to be run on every change._

- **E2E tests:** `npm run test-e2e`
  _Run all the end-to-end tests once. These test may hit actual API endpoints or perform expensive
  I/O operations and are considerably slower than unit tests._

- **All tests:** `npm test` / `npm run test`
  _Run all of the above tests (code-linting, unit tests, e2e tests). This command is automatically
  run before `npm version` and `npm publish`._

- **"Watch" mode:** `npm run test-watch`
  _Watch all files and rerun the unit tests whenever something changes. For performance reasons,
  code-linting and e2e tests are omitted._


[build-status]: https://github.com/gkalpak/ng-pr-merge/actions/workflows/ci.yml
[build-status-image]: https://github.com/gkalpak/ng-pr-merge/actions/workflows/ci.yml/badge.svg?branch=master&event=push
