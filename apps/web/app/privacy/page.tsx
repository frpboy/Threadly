import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Threadly — Privacy Policy",
  description: "How Threadly collects, uses and protects your data.",
};

const h2Style = { marginTop: "1.75rem", marginBottom: "0.5rem", fontSize: "1.15rem", fontWeight: 600 } as const;
const pStyle = { marginBottom: "0.75rem", lineHeight: 1.65 } as const;
const liStyle = { marginBottom: "0.4rem", lineHeight: 1.6 } as const;

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: "44rem", margin: "0 auto", padding: "2.5rem 1.25rem 4rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>Privacy Policy</h1>
      <p style={{ ...pStyle, opacity: 0.7 }}>Last updated: November 21, 2026</p>

      <p style={pStyle}>
        Threadly is a daily puzzle game built and operated by Rahul Muraleedharan (@frpboy), India.
        This policy explains what the Threadly website and Android app collect, why, and the choices
        you have. Questions or deletion requests: <a href="mailto:frpboy12@gmail.com">frpboy12@gmail.com</a>.
      </p>

      <h2 style={h2Style}>What we collect</h2>
      <ul style={{ paddingLeft: "1.25rem" }}>
        <li style={liStyle}>
          <strong>Gameplay data.</strong> Your guesses, puzzle progress, streaks and leaderboard scores
          are stored on our servers so the game works and scores stay fair.
        </li>
        <li style={liStyle}>
          <strong>Guest identifier (website).</strong> If you play in a browser, it creates a random
          guest ID, keeps it in the browser&apos;s local storage and sends it with your gameplay so
          your progress stays attached to your play.
        </li>
        <li style={liStyle}>
          <strong>Player ID (Android app).</strong> The app receives a random, server-issued ID for
          your installation and stores it on your device, protected by the Android Keystore. It is a
          random value used for gameplay; it contains no name, email or other personal details. The
          app shows this ID on the game screen with a Copy button.
        </li>
        <li style={liStyle}>
          <strong>Crash diagnostics.</strong> If the app or website crashes, Sentry receives a report
          with the device model, operating system and technical details of the failure. Our
          crash-reporting code is configured not to attach your name, email or gameplay content.
          Sentry processes and keeps reports under its own policies and settings.
        </li>
        <li style={liStyle}>
          <strong>Usage analytics.</strong> The website uses Plausible, a cookieless analytics tool
          that gives us aggregate page-view counts. Plausible does not use cookies or persistent
          visitor identifiers.
        </li>
        <li style={liStyle}>
          <strong>Preferences on your device.</strong> Theme and streak display settings are stored in
          your browser&apos;s local storage and never leave your device except as gameplay data above.
        </li>
      </ul>

      <h2 style={h2Style}>What we never collect</h2>
      <ul style={{ paddingLeft: "1.25rem" }}>
        <li style={liStyle}>No advertising, no ad tracking, and no sale of your data.</li>
        <li style={liStyle}>No purchases or payment information.</li>
        <li style={liStyle}>No precise location, contacts, photos, microphone or camera access.</li>
        <li style={liStyle}>No keystroke or screen recording.</li>
      </ul>

      <h2 style={h2Style}>Who processes data for us</h2>
      <ul style={{ paddingLeft: "1.25rem" }}>
        <li style={liStyle}>Vercel hosts the website and game servers.</li>
        <li style={liStyle}>Neon hosts the database.</li>
        <li style={liStyle}>Sentry processes crash reports for the website and Android app.</li>
        <li style={liStyle}>Plausible provides cookieless website analytics.</li>
      </ul>

      <h2 style={h2Style}>Retention and deletion</h2>
      <p style={pStyle}>
        Your gameplay history is stored on our server under a random, pseudonymous player ID: on the
        website this ID is generated and kept in your own browser; in the Android app it is issued
        to your device. Gameplay records are not linked to your name or email address, and we do not
        ask for them to play.
      </p>
      <p style={pStyle}>
        In the Android app you can delete your server-side game history (guesses, streaks, stats and
        leaderboard entries) at any time on the game screen with &quot;Delete my data&quot;; this also
        revokes the device&apos;s player profile and cannot be undone. Backup of the app&apos;s data
        is turned off, so clearing the app&apos;s storage or reinstalling it removes the app&apos;s
        local copy of your ID. On the website, clearing your browser&apos;s site data removes the
        browser&apos;s copy of your ID.
      </p>
      <p style={pStyle}>
        To delete website gameplay history, email <a href="mailto:frpboy12@gmail.com">frpboy12@gmail.com</a>:
        if you include your player ID we can delete the matching records directly; if not, we will
        guide you through finding it, because gameplay records cannot be looked up by name or email.
        When you contact us, we use your email address only to handle your request.
      </p>
      <p style={pStyle}>
        Android player profiles expire 90 days after they are created. After a further 30-day grace
        period, the profile and its server-side data become eligible for deletion, which then happens
        automatically during later activity on the service. Our providers (Neon for the database,
        Sentry for error reports) keep their own backups and retained reports under their own
        retention policies and account settings.
      </p>

      <h2 style={h2Style}>Children</h2>
      <p style={pStyle}>
        Threadly is a general-audience puzzle game and is not directed at children under 13. We do not
        knowingly collect personal information from children.
      </p>

      <h2 style={h2Style}>Changes</h2>
      <p style={pStyle}>
        If this policy changes, the updated version will be posted on this page with a new date.
      </p>
    </main>
  );
}
