# AD-SDLC Import Fixture

Target repository of the AD-SDLC Import live acceptance scenarios. It is
pushed to a disposable GitHub repository before each live run.

- `src/text.mjs`: text helpers; the seeded issues add functions here.
- `test/`: the repository's required tests (`npm test`). `required-gate.test.mjs`
  fails when `AD_SDLC_FIXTURE_REQUIRED_FAIL=1` and must not be modified.
