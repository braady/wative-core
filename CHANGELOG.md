# Changelog

All notable changes to `wative-core` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.4] — 2026-08-12

Correctness fixes across signing, storage and the network layer.

### Fixed
- Signing twice, or signing after sending, no longer double-signs a transaction or erases its recorded on-chain outcome.
- A Solana transaction reports the id the network knows it by, not the wallet's own signature — including after a failed broadcast.
- Requests to a node now have a deadline, so an unresponsive endpoint no longer leaves a transaction hanging indefinitely.
- A failed unlock leaves no open session and no stray directories behind, and a workspace root that is a symlink is refused.
- `signTransaction(tx)` returns the type it was given. Type-only: a non-generic value assigned to it now needs the same shape.

## [2.4.3] — 2026-08-11

Documentation only. No API or behaviour changes from 2.4.2.

### Changed
- The README now leads with what a `Record` is and where records can live, and states plainly that one imported key controls both addresses in a PK wallet.

## [2.4.2] — 2026-08-11

Importing a private key is easier, and one import now reaches both chains.

### Changed
- **BREAKING.** A PK wallet now holds two addresses — the chain you imported for, plus one on the other chain derived from the same secret, so one key controls both. `addresses[0]` is unchanged; `addresses.length` is now 2. Existing stored wallets keep their single address.

### Added
- `importPrivateKey(pk)` no longer needs a `vm` — the chain is read from the key — and accepts the JSON byte array `solana-keygen` writes.

### Fixed
- An EVM private key outside the valid range is refused as `INVALID_PRIVATE_KEY` instead of surfacing as an untyped error.

## [2.4.1] — 2026-08-11

One breaking item, and it is the kind worth reading before upgrading: a
transaction no longer guesses which chain it is for. Alongside it, a browser and
a Node process now each get a working storage backend without being told which
one to use, and writing your own backend is documented with a runnable example.

### Security
- **BREAKING. `EvmTransaction` requires `chainId` and no longer defaults to
  Ethereum mainnet.** Building a transaction without naming a chain used to
  produce chain 1. That is not a harmless default: a signed transaction is a
  bearer instrument, so the result was a genuine, broadcastable Ethereum
  mainnet signature that the caller never asked for. The same applied to anyone
  who reached for a `network` field — transactions have never had one, the key
  was discarded, and chain 1 came back. Both are now refused with
  `PARAMETER_ERROR`, and the message names the `network` trap directly.

  TypeScript callers using the object form were already required to pass
  `chainId` and are unaffected. This changes behaviour for JavaScript callers,
  and for the positional form, where `opts` and its `chainId` are now required.

  Nothing changes for `address.buildTransaction()`, which continues to take the
  chain from the address's own network — that remains the shortest correct way
  to build a transaction, and `chainId` there is still optional.

  ```js
  // before — signed for Ethereum, silently
  new EvmTransaction({ from, to, value });

  // after — name the chain
  new EvmTransaction({ from, to, value, chainId: 8453 });
  // or let the address decide
  address.buildTransaction({ to, value });
  ```

### Added
- **A default storage backend in both environments.** `Workspace.open(password)`
  now works in a browser without importing a provider first, using IndexedDB.
  Node continues to resolve its filesystem backend from `wative-core/node`.
- **A worked example of a custom storage backend**, at
  `examples/19-simple-provider.test.cjs`: six methods that move bytes, running a
  whole workspace on a `Map`. The published type declarations now ship the
  documentation for the types you implement against.

### Changed
- **Node's default backend is now `HybridProviderV3`**, falling back to
  `HybridProvider` where the optional native dependency has no prebuilt binary.
  Both read each other's containers, so the fallback costs no data.

## [2.4.0] — 2026-08-11

Six breaking items, each one an operation that reported success without having
done what it said. A broadcast whose reply never arrived was reported as one
that never went out — on both chains. Moving an account between workspaces saved
its later changes to the wrong place; changing a password could leave the old one
working; erasing a browser workspace could leave everything in it; and restoring
a backup over an existing workspace kept records the backup did not contain. The
rest either clears secrets from memory sooner, or accepts input that was being
refused for no reason.

### Security
- **BREAKING. A broadcast whose outcome is unknown no longer reports as one that
  was refused — on both chains.** When the connection to an endpoint died during
  a broadcast, or the endpoint answered with an error status or something that
  was not a reply, the send reported `failed`: the one status meaning "that never
  went out, send it again". Those bytes may well have reached the network. On
  EVM a rebuilt transaction takes a fresh position from a node whose count the
  relayed one already advanced; on Solana there is no position to collide at all,
  so a rebuild takes a fresh blockhash, becomes a different transaction, and
  nothing dedupes the two. Either way both can land.

  Such a send now reports `timeout`, meaning the outcome is unknown, and the
  identifier of the transaction that was signed is reported so it can be looked
  up before anything else is sent.

  An endpoint that answers with a reason it refused still reports `failed`,
  because nothing was sent and sending again is safe. That is the ordinary way a
  send fails — an underpriced or badly-positioned transaction on EVM, an expired
  blockhash or a failed simulation on Solana — and for an expired blockhash
  rebuilding is exactly the right response.
- **BREAKING. An endpoint that refuses is reported differently from one that
  never answered.** Every way a request could go wrong reported the same thing,
  including the one case where the endpoint read the request and declined it.
  Those are opposite facts for a broadcast, and a caller needs to tell them
  apart to know whether sending again is safe. A refusal now carries its own
  error code and the reason the endpoint gave; a lost connection, an error
  status, or an unreadable reply still report the endpoint as unreachable. The
  two chains previously disagreed about which code a refusal carried; they now
  agree.
- **A value an endpoint sent is cleaned before it appears in an error.** Two
  errors raised while reading a reply placed that reply into the message exactly
  as received, so control characters chosen by the endpoint were reproduced into
  whatever log the caller writes, and an overlong value was repeated in full.
  The value is still shown, since for a number the rejected text is the
  diagnosis, but it is cleaned and shortened.

### Security
- **BREAKING. Changing an account's password now reports failure rather than a
  success that did not happen.** If the account was locked between the moment
  the change was requested and the moment it was carried out, the recovery
  phrase was quietly left under the old password while everything else about the
  change was saved. The account then reported that its password had been
  changed, after which the new password failed and the old one still worked —
  the exact reverse of the promise, in the situation you change a password for.
  An account managed by its workspace was additionally recorded as having a
  password of its own, which made it unopenable the next time it was loaded.
  Two changes started at the same time could also both report success, with the
  second overwriting the first using a password the first had already retired.
  Both cases now report failure and leave the account exactly as it was.
- **BREAKING. Erasing a browser workspace now reports whether it happened.**
  Erasing one while the same application still had it open reported success and
  left every stored record in the browser. Because nothing released the
  workspace, that was the ordinary outcome rather than a rare one. The workspace
  is now closed first so the erase can finish. An erase that cannot be confirmed
  is reported as unconfirmed rather than as failed — it may still complete on its
  own, and erasing again is always safe. Erasing where the browser offers no
  storage at all now reports that, instead of returning quietly.
- **Secrets are cleared from memory once they are no longer needed.** Several
  intermediate values produced while deriving a key were left behind after use,
  and a derived key dropped from the internal cache was discarded without being
  cleared, putting it beyond the reach of the cleanup that runs when a workspace
  locks. Unlocking an account whose recovery phrase could not be read also left
  that phrase in memory although the account reported itself locked. Keys and
  addresses are unchanged: derivation was checked byte for byte against the
  previous release and against the published Argon2 test vectors.
- **An endpoint that is not text is refused rather than saved unchecked.**
  `rpcUrl` was the only network field with no type check, so a value that was not
  text skipped every endpoint check — including the one that refuses addresses on
  your local network — and was stored anyway. Leaving the field out reported an
  error from outside this library rather than its own, including while loading a
  stored network. An empty endpoint still means no endpoint configured.
- **A rejected name or colour is quoted before it is reported.** Both were placed
  into the error message exactly as supplied, so control characters in them were
  reproduced into whatever log you write. A name is not always your own — it can
  come from a filename on disk, or from a backup being restored.

### Fixed
- **BREAKING. An account moved to another workspace now belongs to the workspace
  holding it.** Moving one wrote a single record into the receiving workspace and
  then kept sending every later change back to the workspace it came from.
  Reopening the receiving workspace showed the account without those changes, and
  closing the original one made the account unusable even though the receiving
  workspace was open and still listed it. For an imported private key, discarding
  the original workspace lost the key. The account now saves to the workspace
  holding it, unlocks with that workspace's password, and is closed by it.
  Locking the receiving workspace while the move is still going on now closes the
  account rather than leaving it open and unreachable. Re-deleting an account
  that was moved in reports that it is already gone, rather than reporting it as
  belonging elsewhere.
- **BREAKING. Restoring a backup over an existing workspace now replaces it.**
  Records the backup did not contain were left in place beside the restored ones,
  still under the previous password. They could not be opened, could not be seen,
  kept their names reserved, and made removing a network fail from then on. Only
  what the backup carries is kept now, and anything it omits is removed. A backup
  that cannot be restored in full is refused before anything changes, and a
  backup carrying no configuration is refused outright rather than leaving a
  workspace no password can open. The workspace is closed at the end, since the
  password that opened it belonged to the workspace that was just replaced.
- **A wallet can be labelled in your own script.** Tags and token symbols
  accepted the letters of every script but refused the marks that most of them
  require, so Devanagari, Bengali, Tamil, Thai, Arabic and Hebrew could not be
  used at all. They now are. A label that would display as blank, or as nothing
  at all, is still refused. Token symbols containing `+` are also accepted, which
  several real tokens need.
- **The two spellings of one password are one password.** The same password can
  arrive in two forms depending on the keyboard, clipboard or operating system it
  came from, and both have always unlocked a wallet. Several places compared the
  forms directly instead, so a correct password could be reported as wrong when
  re-entered on an already-open workspace or account, when confirming a record's
  password, and when creating an account that shares the workspace password.
  Checking a new password against previous ones now recognises the same password
  in a different form as a reuse.
- **A deleted account's name can be used again.** Every account name seen when a
  workspace opened was reserved for as long as it stayed open, and deleting the
  account did not release it. Creating an account under that name again quietly
  produced a numbered variant, and adding one back was refused with a message
  asking you to restore a file that had just been deleted.
- **A token address pasted with a leading space is accepted.** It was refused
  here while the same address was accepted everywhere else in the library.
- **A hex value carrying two prefixes is refused rather than decoded.**
  `0x0x41` produced two bytes with a zero in front instead of an error.
- **Moving an account needs the networks it uses to exist in the receiving
  workspace.** An account refers to its networks by name, so moving one into a
  workspace that does not have a network it uses wrote a record that could not
  be read back. The move reported success, and after reopening the account was
  simply absent — not listed, not reported as held back, and not even holding
  its name, while a record containing its recovery phrase and every key stayed
  in the workspace, unreachable and impossible to remove. The move is now
  refused before anything is written, naming the missing network.
- **An account cannot be left holding no keys.** Both ways of removing wallets
  checked that at least one wallet remained, which does not mean at least one
  key remains: a wallet can legitimately be added without addresses, so removing
  the wallet carrying an account's only keys left an account with none. It still
  reported itself as an account, and reopening it produced a shell with nothing
  in it. Removing wallets that hold no keys is unaffected, as is removing an
  account outright.

## [2.3.9] — 2026-08-10

Three breaking items. Two are on paths that were producing results no
counterparty could act on; the third changes how a refused broadcast is
reported, on both chains, so that it cannot be read as "safe to send again". Everything else here narrows what error messages reveal, or
accepts input that was being refused for no reason.

### Security
- **BREAKING. The endpoint-reply check now covers Solana.** 2.3.6 stopped an
  endpoint choosing which transaction was watched after a broadcast, but that
  check only ever applied to EVM sends — the Solana lane still took the reply at
  face value, so an endpoint could hand back an identifier of its own and report
  results for a transaction you never sent. That reply is now checked against the
  transaction that was actually signed, and everything afterwards follows the
  signed value. A send refused
  for this reason reports `timeout`, not `failed`, because the endpoint did
  acknowledge it and the transaction may well have been relayed — look it up by
  its signed signature before sending anything else, and do not rebuild it with a
  fresh blockhash. The signed identifier is still reported, so it can be looked
  up. Endpoints that answer correctly are unaffected.
- **BREAKING. A refused broadcast reports `timeout`, not `failed`, on EVM too.**
  The same check on the EVM side already refused an endpoint that acknowledged a
  broadcast with the wrong identifier, but reported the result as `failed` — the
  one status a caller reads as "that never went out, send it again". The
  endpoint did acknowledge it, so those bytes may be on the network: a retry can
  then take a fresh position and both transactions land. It now reports
  `timeout`, meaning the outcome is unknown, and the error still names both
  identifiers. The transaction continues to report the identifier it signed, and
  awaiting its submission now fails with that same explanation rather than
  reporting that it was never sent.
- **An RPC URL missing its scheme was handed back with one attached.** Provider
  dashboards present an endpoint host-first with the key in the path and no
  scheme. Pasting that produced an error that repeated the whole value with
  `https://` prefixed — a ready-to-use secret URL, in a message that can reach a
  log file or a crash reporter. Both refusals for an unparseable RPC URL now say
  what is wrong without repeating any of it. A rejected scheme and a blocked
  host are still named, since those are not the caller's secret.
- **A value rejected as a malformed number is no longer shown in full.** This
  completes the sweep 2.3.8 began, which was scoped to address fields and noted
  that amounts and gas prices were still shown whole — that note no longer
  applies. A private key or recovery phrase pasted into an amount, a gas price or
  a gas limit used to appear in the error in its entirety. Such a value is now
  shortened. It is shortened rather than removed because for a number the
  rejected text is the diagnosis: a thousands separator, a stray decimal point or
  an exponent is still perfectly legible.
- **The last two address errors stopped repeating their value.** A token
  contract address that is not a valid address, and a network's multicall
  address, were the two sites the 2.3.8 sweep left. Adding a custom token by
  contract address is something an end user does by pasting, and the same slip
  applies. Both now name the field instead of showing its contents.

### Fixed
- **Malformed typed data, measured.** Of twenty-four malformed payload shapes,
  twenty-two are now refused with this library's own error code and none escapes
  as an untyped error. The remaining two — a domain given as an array or a
  number — are signed deliberately, because every other implementation signs
  them identically and refusing them would break real callers.
- **BREAKING. A field whose declared type is not a type at all is now refused.**
  A type is a name followed by zero or more array suffixes and nothing else.
  Anything trailing the suffix — `uint256[]extra`, `uint256[2]junk` — or an
  unclosed bracket such as `uint256[` was accepted, and produced a signature no
  counterparty could check. Such a payload now reports
  `PARAMETER_ERROR` naming the type, which is what other implementations already
  do. Every valid type signs exactly as before, including nested and fixed-size
  arrays such as `uint256[2][3]`, a zero-padded length such as `uint256[01]`, and
  the shorthands `uint` and `int`.
- **An amount too large to exist is refused when you set it, not when you
  sign.** Every numeric field of an EVM transaction holds a 256-bit value, and
  a larger one was accepted and carried all the way to signing, which then
  failed with a message naming neither the field nor the reason. Such a value
  is now refused immediately and by name. The largest legal value is still
  accepted, and nothing was ever silently altered.
- **A wallet's address list can no longer be rewritten in place.** It is
  declared read-only and, unlike an account's wallet list, nothing enforced
  that: assigning an entry, truncating it, pushing to it or deleting from it
  were all accepted, and the next ordinary save wrote the result through. Both
  lists now refuse those, and both also refuse being frozen or having their
  prototype changed — neither of which writes anything itself, but both of which
  make a later legitimate change fail from somewhere the caller cannot connect
  to what they did. Reading, iterating and the collections' own methods are
  unchanged.
- **More invisible characters are removed from names.** Free-text names — a
  wallet's display name, an asset or network name — are cleaned of characters
  that carry no glyph before anything else looks at them, so nothing can hide
  inside a word. Five that were missing are now included, among them the
  directional isolates, which belong to the same family as the overrides that
  were already covered. Emoji are untouched.
- **A malformed Solana address is reported the same way wherever it is given.**
  Depending on which call it came through, the same mistake produced either this
  library's own `PARAMETER_ERROR` or a bare decoding error with no code — and in
  one case nothing at all until much later, from a place that could no longer
  say which address was at fault. Every one of them now reports
  `PARAMETER_ERROR` and names the field. Nothing that built before is refused.
- **A typed-data payload that declares `EIP712Domain` as null no longer throws a
  raw error.** Naming that key as a field's type, with the key itself set to
  `null` or `undefined`, produced a `TypeError` from inside the encoder instead
  of a `PARAMETER_ERROR`. Leaving the key present but empty while nothing
  references it is a normal payload and still signs, byte for byte as before.
- **A Solana fee payer naming the sending account is no longer refused.**
  Signing rejected any fee payer that was not the exact same string as the
  sender, so supplying the sender's own key as a public-key object or as raw key
  bytes — both of which build correctly for external signing — was turned away,
  as was `null`. All three now sign, and describe a transaction identical to
  leaving the field out. A fee payer naming a genuinely different account is
  still refused, and is still available for external signing.

## [2.3.8] — 2026-08-09

Typed-data signing (`signTypedData`) is stricter about payloads that were
producing signatures no counterparty can verify. If you sign typed data, read
the three breaking items below. Nothing else here changes what is accepted.

### Security
- **Four address errors no longer repeat the value they rejected.** A
  destination that is not a valid address, a malformed Solana recipient, a
  Solana fee payer that differs from the sender, and a transaction whose sender
  does not match the address signing it: each used to include the value it had
  just refused. Pasting a private key into a destination field is an easy slip,
  and the message could then reach anything that records errors — a log file, a
  crash reporter, a support ticket. Each now names the field that was wrong
  instead of showing its contents. An address that IS valid is still shown, so
  a checksum typo remains easy to spot. Note this covers address fields: a
  value rejected as a malformed *number* — an amount, a gas price — is still
  shown in full.
- **BREAKING. A domain carrying an unrecognised field is now refused.** Only
  `name`, `version`, `chainId`, `verifyingContract` and `salt` are part of an
  EIP-712 domain. A misspelled or mis-cased field — `chainID` with a capital D,
  or keys lower-cased by a JSON round-trip — was previously dropped in silence,
  and the signature was then bound to no chain and no contract at all. Such a
  payload is refused rather than signed. A domain with no fields still signs,
  unchanged.

### Fixed
- **BREAKING. A field typed `uint` or `int` now signs as `uint256`/`int256`.**
  These are the same types under a shorter name and every other implementation
  treats them that way; this one did not, so the signature verified as a
  different address than the actual signer, with no error anywhere. Any
  signature previously produced for such a field changes — the new one is the
  one a counterparty accepts. Fields with an explicit width are unaffected.
- **BREAKING. A fixed-size array field must hold exactly its declared number of
  values.** `uint256[2]` given three values used to sign something no verifier
  would evaluate; it is now refused.
- **Malformed typed data reports this library's error.** Bad values in `message`
  — a missing or `null` nested struct, a number out of range for its declared
  width, a malformed address or byte length, an unreadable field — now report
  `PARAMETER_ERROR` naming the field, instead of escaping as a plain error with
  no code. Payloads that signed before still sign, and produce the same
  signature; only the error changed.
- **A malformed recipient on a native SOL transfer reports this library's
  error.** Such an address was always rejected, but by an underlying library, as
  a plain error carrying no code — so it could not be handled alongside every
  other failure. It now reports `PARAMETER_ERROR` naming the field, and says
  whether the address is not valid base58 or is the wrong length. Every address
  that built before still builds; only the error changed.

## [2.3.7] — 2026-08-08

A security and correctness release. Upgrade if you display names your users
typed, import Solana keys, send Solana transactions, or rely on the password
strength report.

### Security
- **A hidden character could smuggle a dangerous link into a display name.**
  Names, tags and other free-form text are cleaned before storage, and that
  cleaning removed dangerous prefixes like `javascript:` before it removed
  zero-width and control characters. A single invisible character placed inside
  such a prefix therefore survived the check and was then tidied away, handing
  back exactly the thing that was supposed to have been removed. Anything
  putting a stored name on a page received a working link. All affected
  prefixes and every invisible-character class are covered.
- **The password strength report described a different password than the one in
  use.** Passwords are normalised before the key is derived, but the strength
  check read the text exactly as typed. A password written in decomposed form —
  ordinary for some keyboards and languages — was reported as longer and
  stronger than the secret actually protecting the wallet, and could pass a
  minimum-length rule the real one fails. The report now measures what is
  actually used. Nothing about existing wallets or how keys are derived changes,
  and the warning about passwords that shift form between machines is unchanged.

### Fixed
- **A malformed Solana private key is now refused in this library's terms.**
  Such a key was always rejected, but by an underlying library, as a plain error
  carrying no error code — so it could not be handled alongside every other
  failure. It now reports `INVALID_PRIVATE_KEY`, matching what the EVM side
  already did.
- **A rejected logging change no longer takes effect anyway.** Changing sinks or
  the log level while the workspace is locked correctly fails — but the new
  settings were applied before that failure, leaving the previous sinks closed
  and, for file logging, records being written under a configuration you were
  told had been rejected. Nothing changes now unless the change succeeds.
- **Closing RPC clients now closes all of them.** Solana connections were left
  open, each holding a network connection and two timers, once per endpoint used
  for the lifetime of the process.
- **An expired Solana transaction now says so.** Previously it was polled for the
  full two minutes and then reported as a timeout — the same answer given for a
  slow node, though the two call for opposite responses. A timeout means the
  outcome is unknown and sending another transaction risks paying twice; an
  expired one can never be accepted, so replacing it is safe. It now ends as
  dropped, saying the blockhash expired.
- **Wallet lookup by tag is no longer case-sensitive**, matching how the same
  method already looked up accounts and addresses. Tags keep the capitalisation
  you gave them.

### Added
- **`workspace.damagedAccountSlugs`** lists account records that are present but
  could not be opened. Such a record is deliberately kept rather than discarded,
  and creating an account with the same name will not overwrite it — but until
  now nothing reported that it existed, and the only visible sign was new
  accounts receiving unexpected names. The list is read-only: removing such a
  record is left to you, because it may still hold a recoverable recovery
  phrase.

## [2.3.6] — 2026-08-08

A correctness release for anyone who sends transactions. Several ways a
transaction could do something other than what you asked, or be reported as
something it was not, all of them silent.

### Security
- **A redirect could carry your RPC request to a host you never configured.**
  The RPC address you set was checked, but a redirect from that address was
  followed automatically — and the kinds that preserve the request body would
  re-send the whole call somewhere else, including addresses the check exists to
  block. Redirects are no longer followed, and one is now reported as a
  redirect, naming where it was being sent, rather than as an unreachable node.
- **The transaction being watched was chosen by the endpoint.** After a
  broadcast, the identifier the endpoint replied with was taken at face value
  and everything afterwards followed it — so an endpoint could hand back an
  identifier of its own and report a result for a transaction you never sent,
  while yours went unwatched. That reply is now checked against the transaction
  that was actually signed. An endpoint that does not acknowledge a broadcast
  still reports no identifier, exactly as before.
  (Scope correction, added in 2.3.9: this covered EVM sends only. The wording
  above did not say so, and the Solana lane kept taking the reply at face value
  until 2.3.9.)
- **A mistyped token contract address was silently corrected.** The same
  checksum repair that was fixed for transaction destinations in 2.3.5 also
  applied where you supply a token's contract address. It is now refused.
  Addresses given entirely in lower or upper case are unaffected.

### Fixed
- **Call data with an odd number of digits changed the function being called.**
  It was padded on the left, which shifts every byte — turning a token transfer
  into a call to something else, with the arguments shifted too. The
  transaction signed, sent and mined perfectly well; it simply did something
  else. Such call data is now refused, because what was intended cannot be
  known.
- **An automatic nonce could be handed out more than once.** The nonce was
  requested from the node every time and nothing recorded what had already been
  used, so transactions prepared before the node caught up all received the same
  one. Sending three transfers in a row let one arrive while the rest could
  never be mined, and all three reported as sent. A nonce you supply yourself is
  still honoured exactly as given, so replacing an in-flight transaction with a
  higher fee works as before.
- **A mined transaction could be reported as a failed send.** One unreadable
  field in an otherwise successful receipt — the gas figures — was enough to
  report the whole send as failed and to discard the receipt proving the funds
  moved. Those figures are now read tolerantly and simply omitted when they
  cannot be read.
- **An address will not sign for one chain and send to another.** An address and
  the network it is pointed at could disagree about which chain they belong to;
  signing now refuses rather than producing a signature for one chain and
  handing it to another.
- **A signed transaction's fields can no longer be changed.** Editing a field
  after signing was accepted and reported back, while the bytes that would be
  sent still carried the original values. This covers both EVM and Solana
  transactions. Build a new transaction to change something.
- **A wallet list handed to you can no longer be modified in place.** Assigning
  to it changed the account's own list, and the next save wrote that through.
- **A dropped network no longer comes back.** Saving a network after removing it
  added it again, in memory and on disk.
- **A blank address filter no longer matches the first address**, and passing
  something that is not an account now reports a parameter error rather than an
  unrelated type error.
- **Creating an account no longer overwrites one another handle just created.**
  Two handles open on the same workspace could each create an account with the
  same name, leaving one record holding the second recovery phrase and
  destroying the first.

## [2.3.5] — 2026-08-07

A security release. Upgrade if you send EVM transactions, or if you keep more
than one account in a workspace.

### Security
- **A mistyped destination address was silently corrected.** An EVM address
  carries a checksum whose whole purpose is to catch a mistyped character. When
  a transaction destination arrived with a checksum that did not match, it was
  quietly rewritten into a valid-looking address rather than refused — so a
  single wrong character could send funds to an address you never typed, with no
  warning. Such a destination is now rejected. Addresses given entirely in lower
  or upper case carry no checksum to check and are unaffected, and address
  lookup stays as forgiving as before.
- **An account could overwrite another account's stored secrets.** On macOS and
  Windows, where file names ignore case, creating an account could write over a
  stored account whose name differed only in capitalisation — destroying the
  sealed recovery phrase it held. Names are now checked the way the file system
  actually compares them.
- **Two addresses reached cloud metadata services.** The RPC URL check missed one
  IPv6 spelling of the metadata address, and the well-known metadata host names
  entirely.
- **Sealed material no longer appears when an object is logged.** The stored
  recovery phrase and stored keys were ordinary visible properties, so they
  surfaced in `console.log` output and in anything that walks an object's
  properties.
- **A password policy option set to `undefined` no longer disables it.** Building
  an options object from optional values — the ordinary way to forward
  settings — removed the minimum-length rule entirely, so short passwords stopped
  being reported.

### Fixed
- **`confirmed` no longer fires for a reverted transaction.** Subscribers were
  told a transaction had confirmed, receiving a receipt whose own success flag
  was false, and only afterwards told it failed.
- **A stray file no longer blocks removing a network.** A single duplicate left
  in the storage folder — the kind a file manager creates — made network removal
  refuse permanently.
- **A log file prefix can no longer choose the directory.** A prefix containing
  path separators wrote the log outside the folder it was given. Sizes and file
  counts are validated too.
- **Aborting a transaction cannot leave a stale finish behind.** Internal
  finishing can no longer be triggered while a transaction is still in flight.
- **Key material is cleared in three more places** where an unusual failure —
  one bad address, an interrupted derivation, a rolled-back add — previously left
  it in memory.

## [2.3.4] — 2026-08-07

A security release. Upgrade if you hold keys in a long-running process, or if
you log anything from a Solana wallet.

### Security
- **Key material could survive `lock()`.** Two separate cases. Records sealed by
  the optional faster storage format left one readable copy of each record's key
  in memory after the workspace was locked — and because that format seals each
  secret the same way, such a copy is the secret itself. Separately, part of the
  password-derivation scratch space was not being cleared, leaving
  password-derived bytes resident. Both are now cleared, and both are covered by
  checks that can actually observe the memory in question.
- **`lock()` could return while an account stayed unlocked.** An `unlock` that
  landed at the same moment as a `lock` could complete inside it: the workspace
  reported locked while the account still held its mnemonic and could sign, and
  no later `lock()` could reach it. Locking is now closed to that race.

### Fixed
- **Signing typed data with a `bytes` field.** A `Uint8Array` or `Buffer` was
  hashed as text rather than as its bytes, so the signature did not match what
  any other implementation computes — and two containers holding the same bytes
  gave two different results. Passing a `0x` string was, and remains, correct.
  Text that is not `0x`-hex is now rejected rather than silently hashed a
  second, incompatible way.
- **Malformed typed data now raises the library's own error.** Several shapes —
  including a `primaryType` naming a built-in type, and a struct that contains
  itself — escaped as a raw `TypeError` with no error code. (This entry
  originally gave a count. It was not reproducible against the released build
  and has been replaced by the property it was trying to describe; the current
  coverage is stated under 2.3.9.)
- **Solana signatures and transaction ids are no longer removed from logs.** The
  redactor treated any long base58 value as a secret, which is exactly the shape
  of a signature, so the one value worth correlating on disappeared silently.
  Redaction by field NAME was broadened at the same time, so tokens, passcodes
  and recovery keys that previously slipped through are now covered.
- **Logging a non-string no longer throws.** `logger.info(x)` where `x` was
  undefined, a number or an object took down the caller.
- **Adopting an account into another workspace** now refuses when that
  workspace's password would not open it, instead of writing a record that can
  never be opened again.
- **Adding an account no longer loses concurrent work.** Wallets derived while
  the account was being added were kept in memory but never written.

## [2.3.3] — 2026-08-07

A security fix for typed-data signing. Upgrade if you use `signTypedData`.

### Security
- **A signature could be produced for a value other than the one you were shown.**
  When a typed-data payload declared a custom type whose name collides with one of
  EIP-712's own built-in type names, a field of that type was not bound by the
  signature: every value produced the same result, and an independent verifier
  read the field as a fixed value nobody chose. The same collision could also
  detach a signature from the chain and contract it was meant for. Because the
  payload is normally supplied by the site requesting the signature, this did not
  require anything unusual from the wallet holder. Such payloads are now rejected
  with `PARAMETER_ERROR`, which is also what other EIP-712 implementations do, so
  no payload that they accept is affected.

### Fixed
- **A retired wallet index could come back.** Dropping a wallet records its index
  so it is never derived again. If another account setting was changed at the same
  moment, that record could be lost, and the next `deriveWallets()` returned the
  same address and private key as the wallet that was dropped.
- **`sliceWallets` could empty an account.** It kept no minimum, so on an account
  whose first wallet had already been dropped it could remove every remaining
  wallet, leaving an account with no keys and reporting no error. It now refuses,
  as `wallet.drop()` already did.
- **Aborting a transaction no longer reports a confirmation afterwards.**
  `abort()` could still fire `confirmed` listeners for a receipt that arrived
  after the abort, having already reported the failure. The receipt itself is
  still kept on the tracker — if the transaction did land, you can still see it —
  but it is no longer announced as a confirmation, and the abort remains the
  reported cause.
- **Secrets are cleared in two cases where they were kept.** A wallet drop, or a
  password reset, that failed because the workspace was locked at that moment
  could leave key material in memory that a later `lock()` would not reach.

### Changed
- ⚠️ **`whenFinalized()` now rejects instead of never settling.** Transaction
  tracking ends at first inclusion, so on EVM — and on Solana whenever the node
  reports `confirmed` first — this promise previously neither resolved nor
  rejected. It now rejects with `UNSUPPORTED_OP`. A Solana node that reports
  finality directly still resolves as before.

  **Migration.** `void tracker.whenFinalized().then(...)` used to do nothing,
  because the promise never settled; it is now an unhandled rejection and will
  terminate a Node process. Attach a `.catch()`, or await it. Awaiting it
  alongside `whenConfirmed()` is unaffected.
- **A `types.EIP712Domain` list that disagrees with your domain is now rejected**
  rather than ignored. The domain separator has always been computed from the
  domain object itself, so a mismatched list previously produced a signature that
  your own verifier would reject, with nothing to point at the cause. An empty or
  absent list still works, so the JSON-RPC shape is unaffected.

- ⚠️ **Documented late — this shipped in 2.3.3 without a note.** `record.unlock(password)`
  on a record that is already open now re-checks the password instead of returning
  success. Records arrive already open in the common case, so a caller using
  `record.unlock(pw)` as a password check was previously told yes for **every**
  string, including a wrong one. It also refuses once the workspace has been locked
  or the record dropped, where a retained handle used to keep answering password
  guesses indefinitely.

  **Migration.** If you relied on `unlock()` succeeding for an already-open record,
  pass the real password. Reading `.value` is unaffected — that is a snapshot you
  already hold, and it is deliberately not gated.

## [2.3.2]

Not released.

## [2.3.1] — 2026-08-07

A types-only fix. Six types that appear in the public API could not be imported,
so TypeScript users could call a method but not write down what it took or
returned. Nothing changed at runtime, and JavaScript users are unaffected.

### Fixed
- `OpenOptions` (the options bag for `Workspace.open()`), `PasswordCheckContext`,
  `NetworkConfig`, `AbiItem`, `SplTokenArgs` and `SplTokenAccountSet` are now
  exported and can be imported by name.

## [2.3.0] — 2026-08-06

Unlocking is much faster. Drop-in from 2.2.x; wallets from 1.x need a manual step first.

### Added
- An optional storage format that keeps unlocking fast however many addresses an account holds.

### Changed
- Unlocking is roughly 25x faster. In a browser, allow `'wasm-unsafe-eval'` in your Content-Security-Policy, or it quietly falls back to a much slower path.

### Removed
- Wallets created by 1.x can no longer be opened — export their secrets with 2.2.x before upgrading.

## [2.2.1] — 2026-07-29

Documentation and packaging only. `dist/` is byte-identical to 2.2.0 — no source changed, so the published build was deliberately left exactly as built and verified for that release.

### Changed
- **The runnable examples ship as `examples/` instead of `tests/`.** They are the only human-readable code in the published package, and `tests/` reads as internal scaffolding nobody is invited to open. The `files` allowlist follows. Consumers who referenced `wative-core/tests/...` by path must update; nothing importable from the package entry changed.
- **README** gains npm / CI / node / license badges, an ASCII diagram of the containment model (`Workspace > Account > Wallet > Address`), and a section distinguishing the two account kinds. The HD/PK difference is not in the nesting but in what a `Wallet` *means* — a derivation slot holding both an EVM and a Solana key under HD, versus a single imported key on one chain under PK. That was previously described in prose only, and it is the thing new users get wrong first.

### Fixed
- **`11-subpath-imports` example** imported the chain artifacts by relative path into `dist/` rather than by subpath, despite its own header documenting the subpath form. It resolved inside the repo and nowhere else, so it passed in-repo while being broken for every real installation. Caught by the new published-package CI job before release.

### Internal
- `.github/workflows/ci.yml`: runs the examples against this build on Node 22.12 and 24, and separately installs `wative-core` from the registry into a clean directory and runs the same files against it — exercising the real tarball's `files` list, `exports` map and dependency resolution. Runs weekly as well, since a published package sits on a moving dependency graph.
- The private development repo is now guarded against reaching npm (`private`, a `prepublishOnly` refusal, and a `publishConfig` registry pointing nowhere). It shares a package name with the public repo, so a stray publish there would have succeeded and replaced the package.

## [2.2.0] — 2026-07-28

> **The browser entry is here.** The main entry now resolves for a browser with **zero** unresolvable Node builtins, and ships an IndexedDB storage backend. **No public API was removed** — existing Node imports keep working unchanged, so this remains a minor.

### Added
- **`IdbProvider` — IndexedDB storage backend.** Created via the async factory `IdbProvider.create(name, opts)`, which negotiates durable storage before returning. Exposes `durability` (`"persistent" | "best-effort"`) and a `quota` snapshot.
- **`ContainerProvider`** — the storage-agnostic base extracted from `HybridProvider`. A custom backend now implements only six primitives (`_exist`, `_listItems`, `_read`, `_write`, `_remove`, `_ensureDir`) and inherits record framing, the encrypted envelope and its identity AAD, the key layout and the container session. Previously `Provider` declared the record API abstract, so a custom provider had to reimplement encryption — which is why the shipped custom-provider example carried a hand-rolled XOR cipher and a warning to use a real one.
- **`exportContainer()` / `importContainer()`** on `ContainerProvider`. Both require an unlocked workspace and throw `WORKSPACE_LOCKED` otherwise — a precondition that was not stated when they shipped. Sealed records move verbatim — never decrypted, so no key is materialized and nothing is re-keyed. Because every backend shares one framing, a container round-trips IndexedDB ⇄ filesystem and opens with the same password. Import refuses a non-empty target without `{ overwrite: true }` and rejects entries outside the container layout.
- **`wative-core/node` subpath** — `HybridProvider`, `FileSink` and the default-workspace-path resolver.
- **`STORAGE_NOT_DURABLE`** error code.

### Changed
- **The root entry is condition-split.** A browser bundler resolves the universal core; Node resolves an entry that still re-exports `HybridProvider` and `FileSink`, so `import { Workspace, HybridProvider } from "wative-core"` compiles and runs exactly as before. Those two re-exports are **deprecated** in favour of `wative-core/node` and will be removed in a future major. Condition order is significant — `browser` is declared before `node`, since resolvers take the first match.
- `tsconfig` `lib` gains `DOM`; the browser is now a real target.

### Browser notes
- Creating a **new** workspace in evictable storage is **refused** with `STORAGE_NOT_DURABLE` unless `{ acknowledgeEvictionRisk: true }` is passed. Opening an existing workspace is never blocked. Browser storage is evictable and this library holds private keys: Chrome and Firefox treat IndexedDB as best-effort unless `navigator.storage.persist()` is granted, Safari caps script-writable storage at roughly 7 days without user interaction, and private-mode windows may have no IndexedDB at all. Request persistence from a user gesture, and use `exportContainer()` for a durable backup.
- A **`Buffer` polyfill is still required** — `@solana/web3.js` and `@coral-xyz/anchor` read the global. Standard for any Solana dapp.

### Internal
- `scripts/browser-e2e.mjs` (`pnpm test:browser`) bundles the real dist through the `browser` condition, loads it into headless Chromium and drives a full lifecycle against the browser's own IndexedDB, asserting the same published BIP-44 vectors the Node suite pins. Resolving is not the same as running — a build can resolve cleanly and still fail at runtime, as a 2.1.0 regression showed. Wired into `prepublishOnly`.
- The published bundle is exercised under each platform to prove the export map lands where intended; asserting its shape is not the same as asserting a resolver's behaviour.

## [2.1.0] — 2026-07-28

> **Browser groundwork.** This release removes every Node-builtin dependency from the crypto and EVM layers. `wative-core/artifacts/evm` and `wative-core/artifacts/svm` now bundle for the browser with **zero** unresolvable Node builtins; the main entry is down to four (`fs`, `fs/promises`, `os`, `path`), all belonging to the filesystem provider. **No public API changed** — this is a drop-in upgrade from 2.0.7.

### License
- **Relicensed to a Modified MIT License** (previously BUSL-1.1). The library is now free for any use, including commercial. The sole added condition: a product or service generating more than 50,000 USD in monthly revenue must prominently display "Wative" on its user interface. Measured per product, not per company. `package.json` declares `"license": "SEE LICENSE IN LICENSE"`, the npm convention for a non-standard licence.

### Changed
- **`web3` 1.7.3 and `ethereumjs-wallet` 1.0.2 replaced by `ethers` 6.** Both were used only for offline work — a provider-less `new Web3()` for the ABI codec and transaction/message signing, and `ethereumjs-wallet` solely for BIP-44 derivation. All RPC already went through `fetch`. web3's transitive tree (`web3-providers-http`/`ws`, `xhr2-cookies`, `readable-stream`, `cipher-base`, `ethereumjs-util`, `@ethereumjs/common`) pulled in `http`, `https`, `stream`, `events`, `url`, `assert` and `os`, which alone made the package impossible to bundle for a browser. web3 1.x is also end-of-life.
- **Crypto core moved from `node:crypto` to `@noble`.** AES-256-GCM now runs on `@noble/ciphers`; PBKDF2, HMAC and CSPRNG bytes on `@noble/hashes` (Argon2id already used `@noble/hashes`). Every primitive was verified byte-identical against `node:crypto` before the switch. **`Cipher.encrypt`/`decrypt` remain synchronous** — that is why `@noble` was chosen over WebCrypto, whose async-only `SubtleCrypto` would have forced the whole `Cipher` contract async and made this a breaking change.
- **`node:net.isIP` replaced by a pure-JS classifier**, differential-tested against `node:net.isIP` over ~600 valid, malformed and adversarial inputs.
- **Wire format, key derivation and on-disk layout are unchanged.** A workspace written by 2.0.7 opens under 2.1.0 with byte-identical results, and the production KDF parameters (PBKDF2 600 000 iterations; Argon2id t=3, m=64 MiB, p=1) are pinned by test.

### Fixed
- **EIP-712 with an empty `bytes` field no longer crashes.** web3's `keccak256("0x")` returned `null` and broke the signer; empty bytes now hash to the canonical empty-input digest, which is what EIP-712 specifies.
- **Intrinsic-gas validation preserved.** web3 rejected an under-funded `gasLimit` before signing and ethers does not, so the check is reimplemented — a transaction that can never execute is no longer signed and broadcast, burning the nonce.

### Notes for browser consumers
- `wative-core/artifacts/evm` and `wative-core/artifacts/svm` bundle cleanly today (the EVM artifact is ~128 KB min+gzip).
- A **`Buffer` polyfill is still required**, because `@solana/web3.js` and `@coral-xyz/anchor` depend on the global. This is standard for any Solana dapp.
- The main entry still requires the filesystem builtins listed above. Splitting the Node-only surface (`HybridProvider`, `FileSink`) behind a `wative-core/node` subpath, and adding an IndexedDB provider, is planned for 2.2.0.

### Internal
- `scripts/check-browser-bundle.mjs` bundles every published entry for `platform=browser` and ratchets the set of unresolvable Node builtins — failing both on a regression and on a stale baseline, so browser compatibility can only improve. Wired into `prepublishOnly`.
- Known-answer vectors (`tests/kat/`) pin exact bytes for HD derivation, EIP-191/712 signing, ed25519, the ABI codec, all three EVM transaction types, both KDFs and the envelope wire format; a committed v2.0.7 workspace fixture is opened on every run.

## [2.0.7] — 2026-07-21

> **Runtime requirement changed:** this release requires **Node.js 22.12+** (was 18.18+). See *Changed → Dependencies* below.

### Added
- **`Workspace.open()` options object.** `open()` now accepts `{ provider?, path?, password? }` alongside the existing positional form, so the default location no longer needs an `undefined` placeholder: `await Workspace.open({ password })`. Passing both `provider` and `path` is rejected.
- **Automatic create-vs-open with folder validation.** `open()` decides for itself: an existing workspace is opened, an empty or absent location is created, and a **non-empty location that is not a wative workspace is refused** — so a mistyped path can no longer write a workspace into unrelated files. Backed by a new overridable `Provider.inspectContainer()`; `HybridProvider` implements the filesystem check and the base class defaults to permissive, leaving custom providers unaffected.

### Changed
- **`create` parameter is deprecated and ignored.** The third positional argument to `open()` still type-checks so existing calls compile, but create-vs-open is now automatic. The former `"Workspace is not initialized. Pass create=true"` error is gone.
- **Dependencies.** `@solana/web3.js` 1.91.8 → **1.98.4**. The previous pin resolved `rpc-websockets@^7.11.0` to 7.11.2, which no longer ships the `dist/lib/client` entry that 1.91.8 deep-requires — leaving the published package unloadable under plain Node. 1.98.4 requires the package root instead. Its dependency chain reaches an ESM-only `uuid`, which is why the minimum Node version moves to **22.12** (the first release where `require()` of an ES module is supported).

### Fixed
- **Signing.** `signTypedData` rejects a malformed `domain.chainId` with `PARAMETER_ERROR` instead of leaking a raw `SyntaxError`.
- **Transactions.** EIP-1559 auto-fill clamps a defaulted priority fee to a user-supplied sub-gwei `maxFeePerGas` (previously produced an invalid tip-over-cap pair); receipt status is compared numerically so a non-canonical `0x01` is no longer misread as a revert; an auto-estimated `gasLimit` gets a 1.2x safety buffer.
- **Transaction tracker.** `abort()` now wakes pending `whenMined`/`whenConfirmed`/`whenFinalized` awaiters instead of hanging them forever; a failed send rejects those awaiters with the real cause rather than a misleading `TX_TIMEOUT`; `whenConfirmed(n)` with `n > 1` fails loudly instead of silently resolving at first inclusion.
- **Solana.** Anchor instruction accounts now take their signer/writable flags from the IDL instead of being forced to writable non-signer; `memo` is encoded as a real Memo-program instruction; `addressLookupTables` are rejected rather than silently dropped.
- **Workspace.** A network can no longer be dropped while a user-asset still references it, and the cross-queue race that could orphan an asset or an account's default network is closed.
- **Accounts & wallets.** A forced `kind: "HD"` now validates the mnemonic checksum at create time; wallet tag read-modify-write runs inside the account mutation queue; invisible Hangul filler characters are rejected in validated text; `formatUnits` no longer emits a misleading `"-0"`.

### Packaging
- `exports` carries per-condition `types`, so CJS TypeScript consumers resolve the `.d.cts` declarations.
- The `files` allowlist no longer ships the internal `tests/` directory, which had been leaking TypeScript sources into the tarball.

## [2.0.5] — 2026-05-04

### Added
- **`EvmTransaction.toRawTx()` and `SvmTransaction.toRawTx()`.** Hand-off accessors that return the lowest-level transaction representation each chain ecosystem already understands, so callers can route a wative-core transaction through any external signer / RPC client without re-deriving the inputs.
  - **`EvmTransaction.toRawTx(): EvmRawTx`** — synchronous. Returns a plain `{ from, to, value, data, type, chainId, nonce?, gasLimit?, gasPrice?, maxFeePerGas?, maxPriorityFeePerGas?, accessList? }` object matching the `web3.js` / `ethers` / `viem` `TransactionRequest` shape. Unset autofill fields are simply omitted, leaving the consumer's provider to fill them in. Does not sign or hit the network.
  - **`SvmTransaction.toRawTx(): Promise<unknown>`** — async. Returns the underlying `@solana/web3.js` `Transaction` instance with `instructions`, `feePayer`, and `recentBlockhash` populated. The build is cached, so repeated calls return the same instance and a subsequent `.sign()` reuses it.
  - **Build-requirement relaxation on the SVM side.** `SvmTransaction` no longer requires a bound `Address` purely to construct the underlying transaction object — if `recentBlockhash` is supplied at construction, `toRawTx()` builds entirely structurally. An Address is still required when blockhash needs to be fetched over RPC.
- **`EvmRawTx`** type exported from the package entry.

### Changed
- **Cross-OS IO hardening pass.** The `HybridProvider` file backend now applies the Windows `\\?\` long-path prefix when a resolved path crosses 240 chars, canonicalizes the workspace root via `fs.realpath` at unlock, and refuses to traverse symlinked ancestors at write time. Atomic-write temp files use a 64-bit random suffix (was 48-bit) and retry on `EEXIST`; orphan `*.tmp.<rand>` files older than 60 s are swept on first unlock. Directory `fsync` is gated to POSIX. The logger `chmod`s pre-existing log files to `0o600` after open so they don't inherit permissive bits from a prior run under a different `umask`.
- **`tweetnacl` is now loaded behind a lazy singleton.** Matches the existing `web3.js` / `bs58` lazy-load pattern; first call loads, subsequent calls reuse.
- **Per-process KDF cache HMAC secret is lazy-initialized.** No `crypto.randomBytes` call at module load time, removing one pre-condition for browser/Edge runtimes.

### Security
- **Passwords are normalized to NFC at the KDF boundary.** Clipboard managers and OS input methods occasionally hand back equivalent strings in different Unicode normalization forms; without normalization, a workspace sealed on one host would refuse to unlock on another. ASCII passwords are unaffected.
- **`TextDecoder` calls now use `{ fatal: true }`** in every record-payload, recovery-envelope, and decoded-bytes path. Malformed UTF-8 surfaces as `DECRYPT_FAILED` instead of silently substituting `U+FFFD`.
- **Account slug reserved-name lookup is case-insensitive.** Belt-and-suspenders over the slug regex (which already enforces lowercase output) — Windows resolves `CON`/`con`/`Con` to the same device, so reserved-name matching now follows the same rule explicitly.
- **Workspace path resolver throws clearly when no home is available.** Containers and jails without `HOME` / `USERPROFILE` previously fell through to a malformed path; now `Workspace.open()` surfaces a `PARAMETER_ERROR` directing the caller to set `WATIVE_WORKSPACE_PATH` or pass an explicit path.
- **`ENAMETOOLONG` on the on-disk path now returns `PROVIDER_IO`** with an actionable "relocate workspace closer to root" message, distinguishing OS-limit overflow from invalid input (slug length is already capped by the validator).

## [2.0.3] — 2026-05-04

### Changed
- **Default workspace path renamed** from `<cwd>/.wative` to `<cwd>/.wative2`. Existing on-disk workspaces under `.wative/` are not migrated automatically — pass the old path explicitly to `Workspace.open()` if you want to keep using one, or rename the directory.
- **`Workspace.open()` no-arg path now resolves through a 3-tier strategy:**
  1. `WATIVE_WORKSPACE_PATH` env var (if set & non-empty) — wins unconditionally. `~` is expanded.
  2. `<process.cwd()>/.wative2` — used when the env var is unset and the directory already exists on disk. Symlinks at this path are refused (fall through to home) to defend against attacker-controlled redirection on shared/multi-user systems.
  3. `<os.homedir()>/.wative2` — last-resort fallback. Where `create=true` lands on a fresh machine when no env var is set and there's no project-local `.wative2/`.

  Calls that pass an explicit path or `Provider` instance are unaffected — those short-circuit before any resolution.

### Security
- **Envelope v2 — Argon2id + AAD-bound on-disk records.** New seals use Argon2id (RFC 9106; t=3, m=64 MiB, p=1) and bind every record's GCM tag to its on-disk identity. HybridProvider records bind to `wative:v2:record:<recordType>:<slug>`; per-account mnemonic ciphertexts bind to `wative:v2:account:<slug>:mnemonic`; per-address private-key ciphertexts bind to `wative:v2:account:<slug>:wallet:<id>:<vm>:pk`; recovery envelopes bind to `wative:v2:recovery:account:<slug>`. Closes the blob-swap class of attack where an attacker with workspace-dir write access (but not the password) could substitute one record's ciphertext for another's. Legacy v1 records (PBKDF2-SHA256, no AAD) continue to read; new writes are always v2.
- **Slug-collision suffix now CSPRNG.** Was `Math.random()`; now `crypto.randomInt`. Prevents predictable filenames in `accounts/<slug>-<suffix>.db`.
- **The derived seed is zeroed on lock.** `Account.lock()` now overwrites the BIP-39 seed bytes before releasing them. JS string immutability still prevents perfect zeroization of mnemonic + plaintext private keys (documented on `Workspace.lock()`).
- **`useTestKdfIterations` Jest auto-detect removed.** The `typeof globalThis.expect !== "undefined"` opt-in arm fired in any downstream consumer using Jest, not just our own test process. Now requires explicit `WATIVE_ALLOW_TEST_KDF=1` (or `NODE_ENV=test`). Internal-only function; not on the package surface.

## [2.0.1] — 2026-04-29

First release of the v2 line.

### Added
- Seven domain classes — `Workspace`, `Account`, `Wallet`, `Address`, `Network`, `Asset`, `Transaction`. `Network`, `Asset`, `EvmTransaction`, and `SvmTransaction` accept both positional and object-form constructor arguments.
- HD (BIP-39 mnemonic) and PK (raw private key) account modes. Per-account or workspace-shared password.
- `EvmTransaction` and `SvmTransaction` with `TransactionTracker` lifecycle events (`change` / `confirmed` / `failed`) and lifecycle promises (`whenSubmitted` / `whenMined` / `whenConfirmed(blocks?)` / `whenFinalized`).
- 9 pre-loaded networks: ethereum, base, bnbchain, arbitrum, optimism, sepolia, solana, solana-testnet, solana-devnet.
- 23 pre-loaded tokens: native gas tokens for every network plus USDC and USDT on each EVM mainnet (BSC versions are 18-decimal Binance-Peg), WETH on ethereum, and USDC, USDT, WSOL on solana mainnet.
- Custom storage backends — third parties can extend the `Provider` base class and pass an instance to `Workspace.open()`. Default implementation is `HybridProvider` (encrypted files on local disk).
- Subpath imports `wative-core/artifacts/evm` and `wative-core/artifacts/svm` for heavier chain helpers.
- Both ESM and CJS builds with full TypeScript declaration files.
- `Token2022Program` support alongside the legacy SPL `TokenProgram` (extension instructions are out of scope).
- Workspace search via `workspace.filter("Account" | "Wallet" | "Address" | "Asset", query)`.

### Security
- Built-in networks and tokens cannot be dropped from the workspace (they would orphan accounts that reference them by default).
- Concurrent `addAsset` / `dropAsset` and network-collection mutations are serialized — no duplicate ids or slugs from interleaved calls.
- Hydrate-time guards reject corrupted records (duplicate asset ids or network slugs) at workspace open.

### Notes
- Requires Node.js 18.18+. The crypto and address-encoding paths are pure-JS via `@noble/hashes`, `@noble/curves`, and `bs58` — no native gyp build is needed for installation. Some chain helpers (`web3@1.7.x`, `@solana/web3.js`) and a few transitive deps (`ethereumjs-wallet`, `tweetnacl`) currently target Node and are loaded lazily on first use; full Deno / Bun / browser support is partial pending those upgrades.
- Source maps are not published. The npm package contains only compiled JavaScript and TypeScript declaration files. TypeScript source lives in a separate private repository.

[2.0.7]: https://github.com/braady/wative-core/releases/tag/v2.0.7
[2.0.3]: https://github.com/braady/wative-core/releases/tag/v2.0.3
[2.0.1]: https://github.com/braady/wative-core/releases/tag/v2.0.1
