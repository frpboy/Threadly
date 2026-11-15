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
      <p style={{ ...pStyle, opacity: 0.7 }}>Last updated: November 15, 2026</p>

      <p style={pStyle}>
        Threadly is a daily puzzle game built and operated by Rahul Muraleedharan (@frpboy), India.
        This policy explains what the Threadly website and Android app collect, why, and the choices
        you have. Questions or deletion requests: <a href="mailto:frpboy12@gmail.com">frpboy12@gmail.com</a>.
      </p>

      <h2 style={h2Style}>What we collect</h2>
      <ul style={{ paddingLeft: "1.25rem" }}>
        <li style={liStyle}>
          <strong>Account information.</strong> If you sign in, we receive your name and email address
          from our sign-in provider (Neon Auth) and store them with your account.
        </li>
        <li style={liStyle}>
          <strong>Gameplay data.</strong> Your guesses, puzzle progress, streaks and leaderboard scores
          are stored on our servers so the game works and scores stay fair.
        </li>
        <li style={liStyle}>
          <strong>Guest identifier.</strong> If you play without signing in, your browser creates a random
          guest ID, keeps it in local storage and sends it with your gameplay so your progress stays
          attached to your play.
        </li>
        <li style={liStyle}>
          <strong>Android device credential.</strong> The Android app stores a random server-issued
          credential on your device, encrypted with the Android Keystore. It identifies your installation
          for gameplay and contains no personal information.
        </li>
        <li style={liStyle}>
          <strong>Crash diagnostics.</strong> If the app crashes, Sentry receives a crash report with the
          device model, operating system, and technical details of the failure. Crash reporting is
          configured not to send your IP address, name, email, gameplay content or what you tap.
        </li>
        <li style={liStyle}>
          <strong>Usage analytics.</strong> The website uses Plausible Analytics, a cookieless,
          privacy-friendly tool that gives us aggregate page-view counts. It does not use cookies and
          does not collect personal data.
        </li>
        <li style={liStyle}>
          <strong>Preferences on your device.</strong> Theme and streak display settings are stored in
          your browser's local storage and never leave your device except as gameplay data above.
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
        <li style={liStyle}>Neon hosts the database and provides sign-in (Neon Auth).</li>
        <li style={liStyle}>Sentry processes crash reports for the website and Android app.</li>
        <li style={liStyle}>Plausible provides cookieless website analytics.</li>
        <li style={liStyle}>
          Google Gemini is used by the operator, server-side only, to help generate puzzle content.
          Your personal data is not sent to Gemini.
        </li>
      </ul>

      <h2 style={h2Style}>Retention and deletion</h2>
      <p style={pStyle}>
        Gameplay and account data are kept while your account or guest history is active. Crash reports
        are retained by Sentry for a limited period. To delete your account, guest history or any data
        we hold about you, email <a href="mailto:frpboy12@gmail.com">frpboy12@gmail.com</a> and we will
        remove it.
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
