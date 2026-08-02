# Contributing

Thanks for taking an interest in `wative-core`.

## This repository is generated

Everything here — `dist/`, `examples/`, `README.md`, `CHANGELOG.md`,
`package.json` — is **build output**, published from a separate private
development repository.

That means **pull requests against this repository cannot be merged**. Any edit
made here is overwritten the next time a release is built, so a PR would be lost
even if we agreed with it. We'd rather tell you that up front than let you spend
the effort.

## What is useful

- **Bug reports.** Open an issue. Include the version, your Node version and OS,
  a minimal reproduction, what you expected, and what happened. Reproductions
  based on the files in [`examples/`](./examples) are ideal — they run standalone.
- **API and documentation feedback.** If something in the README is wrong,
  unclear, or teaches a pattern that doesn't work, an issue is genuinely
  valuable — that class of problem is easy for us to miss from the inside.
- **Feature requests.** Describe the use case rather than the implementation;
  we can usually find a better fit for the API surface that way.

## Security issues

Do **not** open a public issue. See [SECURITY.md](./SECURITY.md).

## Licence

The Work is distributed under the Business Source Licence 1.1 — see
[LICENSE](./LICENSE). It is source-available, not OSI open source: production
use is restricted until the Change Date stated in the licence. Please check that
the terms fit your intended use before building on it.
