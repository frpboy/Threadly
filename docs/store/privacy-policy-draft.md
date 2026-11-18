# Threadly Privacy Policy (DRAFT for owner review - not published)

Effective date: [set at publication]
Contact: frpboy12@gmail.com

This draft is grounded in verified app behavior at source 83c69e0 and the
published beta.3 APK manifest. Items in [brackets] depend on the production
hosting decision and must be filled before publication.

## What Threadly is
Threadly is a daily word-guessing puzzle game for Android, operated by Rahul
Muraleedharan ("the developer"). It has no accounts, no ads, and no in-app
purchases.

## Data the game processes

### Gameplay data
When you play, the app sends your guesses and results over HTTPS to the
game's server so they can be scored (scoring is server-side). The server
stores:
- an app-generated device credential (created on first launch, stored in the
  Android Keystore on your device) - no name, email, or account is requested
- your guesses, solve results, points, and game statistics per puzzle
- daily streak and aggregate stats

Stats and progress are also stored locally on your device.

### Crash reporting (Sentry)
If the app crashes, a crash report is sent to Sentry (Functional Software,
Inc., USA), the developer's crash-reporting processor. Release builds carry
this by design. Reports contain technical diagnostics: device model, Android
version, app version, device architecture, memory/battery state, and the
crash stack trace. The app is configured so that:
- Sentry's "send default PII" is OFF (no IP-based user association, username,
  or email is attached by the SDK)
- user-interaction breadcrumbs are OFF, so text you type (including guesses)
  is not included in breadcrumbs
[OPEN: Sentry project-side IP storage setting to be verified and reflected
here before publication.]

## What the game does NOT do
- No advertising or advertising ID
- No analytics SDK other than Sentry crash reporting
- No sale of personal data, no sharing for marketing
- No account creation, no contact lists, no location, no camera/microphone
- Backup is disabled (Android allowBackup=false); uninstalling removes local
  game data

## Service providers
- Sentry (Functional Software, Inc.) - crash reports, as described above
- [Hosting provider(s) for the game server and database - fill from the
  production hosting decision]

## Retention and deletion
Gameplay records are keyed only by the device credential. You can request
deletion of your server-side gameplay data by emailing the contact address
from the same device so the credential can be confirmed; the developer will
delete the associated records within 30 days. Local data is removed by
uninstalling the app.

## Children
Threadly is a general-audience word game and is not directed at children
under 13. The developer does not knowingly collect personal information from
children. The only data processed is the gameplay and diagnostic data
described above, which is not associated with a real-world identity.

## Security
All app-server traffic uses HTTPS; cleartext traffic is disabled in the app.

## Changes
If this policy changes, the updated version will be posted at
[policy URL - to be hosted] with a new effective date.
