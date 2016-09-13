# ng-pr-merge [![Build Status][build-status-image]][build-status]

_Warning:_
_This is still an experimental tool._
_Use at your own risk!_

## Description

A utility for rebase-merging (AngularJS-related) GitHub PRs.
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


[build-status]: https://travis-ci.org/gkalpak/ng-pr-merge
[build-status-image]: https://travis-ci.org/gkalpak/ng-pr-merge.svg?branch=master
