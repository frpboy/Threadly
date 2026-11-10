# Native beta operator gates (not a deployed service)

This candidate is a separate synthetic-only, invite-only beta. It is not an upgrade of the live web database, an account-login replacement, or a qualified release yet.

## Before provisioning

- Obtain independent review of the exact source, migration, native installer and workflow.
- Verify the free-plan limits, target owner, deployment protections and expiry in the actual account. No paid plan, billing increase, production environment change, or reusable bypass secret in the client.
- Use a new empty database and a new restricted database login. Do not reuse production `DATABASE_URL`, OAuth secrets, analytics keys, sessions, users, puzzle content or role credentials.
- A schema-only child is not automatically safe: inspect extensions, event triggers, functions, default privileges, foreign servers, database ownership and inherited role memberships. Leave inherited databases unused. If a clean database and restricted principal cannot be proved, stop and use a separately reviewed empty-project plan instead.
- Confirm the target has no external triggers, foreign tables or security-definer functions that could access another database or service. Record the selected database/project IDs privately.
- Compare the initialized schema to this candidate's Prisma schema and two beta SQL drafts only. Seed only clearly named synthetic puzzles.

## Expiry and bounded access

- The initial operational plan is at most 24 hours. Seven days is a code ceiling, not a promised hosting period.
- A schema-only child inherits roles/passwords, so a new empty free project is preferred if approved. A new root does NOT inherit the child automatic-deletion setting. Arrange explicit owner-authorized cleanup and a deadline check instead of claiming automatic deletion.
- Set one exact UTC expiry with millisecond precision. Use the same epoch-millisecond integer in `THREADLY_BETA_EXPIRES_AT_MS` and the same instant in `threadly_beta_target.expires_at`. Do not independently round the two values.
- `THREADLY_NATIVE_BETA=isolated-synthetic-only`, `THREADLY_BETA_SYNTHETIC_ONLY=true` and a unique `threadly-native-beta-...` target ID are mandatory. A missing or mismatched database target marker denies access.
- Check the actual resource automatic-deletion time. Application and invitation expiry must be earlier, leaving time to remove the test deployment and its secret/environment references.
- Arrange a deadline check before distributing an invitation. At expiry verify API denial, delete the dedicated test deployment/project or disable its endpoint, remove test credentials, and confirm the isolated database is deleted. Never delete a parent production project or branch.
- One owner invitation initially. The global enrollment ceiling is 30 attempts/minute, and a device has a 2,000-request lifetime ceiling. The latter also bounds request-cache growth. Reaching a ceiling denies access rather than silently raising it.

## Enrollment and ambiguous responses

- Generate a cryptographically random 32-byte, base64url invitation without printing it in logs. Store only its SHA-256 hash and expiry in the invitation table. Deliver privately to the owner, never in source, a public release, workflow configuration or an APK.
- Invitation consumption and device creation are one transaction. The device stores its invitation hash, so the operator can revoke the exact result even if the enrollment response is lost.
- If an enrollment response is lost, do not reuse or reset that invitation. In the isolated target only, invalidate its invitation and revoke any device whose `invitation_hash` matches its hash. Verify revocation. Issue a new invitation with a new random value. Record only hashes/non-secret identifiers.
- Do not infer possession of an old guest UUID to grant ownership. The beta creates a new server-owned identity. Old app preferences are not deleted or silently migrated.
- The app's Re-enroll action warns that the new credential does not inherit old beta progress. An existing token is replaced locally only after enrollment succeeds.

## Guess recovery

- Before sending, the app durably saves one request UUID, puzzle and guess in AES-GCM storage backed by Android Keystore. Lost responses keep that same request.
- Retrying uses the same UUID and payload. The server caches the scoring result in the same transaction as the guess and awards; a changed payload with that UUID is rejected.
- The UI offers Retry same request and an explicit Discard pending confirmation. Discard does not undo a guess and warns that it may already have counted. It sends no automatic guess, clears only the local pending intent, and requires a successful saved-progress reload before another guess.
- Access failure offers re-enrollment, not blind replay or a self-asserted-ID fallback.

## Release gate

Record actual source SHA, package/version, existing stable certificate fingerprint, installer digest, dedicated HTTPS endpoint, expiry, API/runtime/native tests, visuals and known limits. The release build refuses a missing endpoint and the known incompatible web-production URL. A build passing this guard is not endpoint or runtime qualification. Do not attach a loopback/offline/About-only APK as this beta.

## Planned real-native fixture (not yet executed)

`BetaEnrollmentTest` requires a separate owned empty loopback Next/PostgreSQL fixture and a runtime-generated invitation passed privately through instrumentation arguments. Run on freshly cleared QA application storage only. The test starts the actual Activity, enters its invitation, submits a wrong guess, resumes after Activity recreation, solves, and resumes finished state. Capture only the empty invitation screen and gameplay screens after the code field has left composition. Its existence does not qualify the app; inspect the test XML, actual server SQL poststate and pixels, and keep network isolation mandatory. Keystore recreation is tested separately; Activity recreation is not proof of OS process death.
