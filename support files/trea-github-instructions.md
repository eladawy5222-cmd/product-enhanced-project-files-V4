

Apply the attached patch file `trea-defensive-parity.patch` on the repository root.

Scope:
- Only keep the changes in:
  - `fts-trip-manager/src/core/http-client.js`
  - `fts-trip-manager/src/publish/updater.js`
- Do not include any unrelated workspace changes.

Intent:
- Restore the defensive parity that exists in `GAS` for HTTP retry/throttling behavior.
- Restore the defensive parity that exists in `GAS` for updater lookup completeness checks, package/image publish guards, and media filename throttling.

Validation:
- Run:
  - `node --check fts-trip-manager/src/core/http-client.js`
  - `node --check fts-trip-manager/src/publish/updater.js`

GitHub publish steps:
1. Create a branch for the fix.
2. Apply the patch.
3. Run the validation commands above.
4. Commit only the two scoped files.
5. Push the branch.
6. Open a PR with a title similar to:
   `Restore defensive parity for HTTP client and updater`

Suggested PR body:
- Reintroduces host-aware HTTP throttling, jitter, broader quota detection, Retry-After handling, and retry coverage for transient failures.
- Reintroduces updater lookup completeness tracking and abort behavior for incomplete Airtable datasets.
- Prevents package and image publishing when Airtable lookups are partial.
- Restores throttling and quota-safe behavior around media updates and filename enforcement.
