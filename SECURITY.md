# Security Policy

`wative-core` handles private keys, mnemonics, and encrypted wallet data. Please
treat any issue that touches key material, encryption, or persistence as a
security issue rather than a normal bug.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through either channel:

- **GitHub** — open a private advisory via the repository's *Security* tab
  ("Report a vulnerability"). This is preferred; it keeps the report and the fix
  discussion in one place.
- **Email** — `brady.c@hedgue.com`.

Please include enough detail to reproduce: the version you tested, the runtime
(Node version, OS), what you did, what happened, and what you expected. A
minimal script is worth more than a description.

## What to expect

- Acknowledgement within a few business days.
- An assessment of severity and affected versions.
- A fix released in a patch version where practical, and credit in the
  changelog if you'd like it.

Please give us a reasonable window to ship a fix before disclosing publicly.

## Supported versions

Fixes land on the latest released `2.x`. Older minors are not backported.

Requires Node.js 22.12 or newer.

## Scope

In scope: anything that could expose a private key or mnemonic, weaken the
at-rest encryption, allow a workspace to be unlocked without the correct
password, or cause a transaction to be signed with the wrong key, chain, or
parameters.

Out of scope: vulnerabilities in the underlying chain libraries themselves
(report those upstream), and issues that require an attacker to already have
read access to an unlocked workspace or the host filesystem.
