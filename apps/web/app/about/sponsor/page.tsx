import styles from "../page.module.css";
export default function SponsorPage() {
  return <main className={styles.page}>
    <a className={styles.back} href="/about">Back to About</a>
    <h1>Support Threadly</h1>
    <p className={styles.intro}>If you'd like to support development, you can use either of these pages. Support is optional.</p>
    <dl className={styles.rows}>
      <div className={styles.row}><dt>Buy Me a Coffee</dt><dd><a href="https://buymeacoffee.com/frpboy" target="_blank" rel="noopener noreferrer">buymeacoffee.com/frpboy</a></dd></div>
      <div className={styles.row}><dt>Patreon</dt><dd><a href="https://www.patreon.com/c/FrpBoy" target="_blank" rel="noopener noreferrer">patreon.com/c/FrpBoy</a></dd></div>
    </dl>
  </main>;
}
