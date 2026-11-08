import webPackage from "../../package.json";
import styles from "./page.module.css";

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <a className={styles.back} href="/">Back to Threadly</a>
      <h1>About Threadly</h1>
      <p className={styles.intro}>A daily five-clue connection puzzle.</p>
      <dl className={styles.rows}>
        <Row title="Developer" href="https://www.frpboy.in/">Rahul Muraleedharan - https://www.frpboy.in/</Row>
        <Row title="GitHub" href="https://github.com/frpboy">github.com/frpboy</Row>
        <Row title="LinkedIn" href="https://www.linkedin.com/in/rahul-muraleedharan-it">linkedin.com/in/rahul-muraleedharan-it</Row>
        <Row title="Support requests" href="https://t.me/FRPboy_Projects">Telegram: FRPboy Projects</Row>
        <Row title="Source / Readme" href="https://github.com/frpboy/Threadly">frpboy/Threadly</Row>
        <div className={styles.row}><dt>Releases</dt><dd>No published releases yet.</dd></div>
        <div className={styles.row}><dt>Sponsor</dt><dd><a href="/about/sponsor">Support Threadly's development</a></dd></div>
        <div className={styles.row}><dt>Credits / licenses</dt><dd>Built with Next.js, React, Prisma and Auth.js. Dependency licenses remain with their respective projects. A project license has not yet been specified in this repository.</dd></div>
        <div className={styles.row}><dt>Web version</dt><dd>{webPackage.version} (package version)</dd></div>
        <div className={styles.row}><dt>Application</dt><dd>Threadly web. This is separate from the Android package.</dd></div>
      </dl>
    </main>
  );
}

function Row({title,href,children}:{title:string;href:string;children:React.ReactNode}) {
  return <div className={styles.row}><dt>{title}</dt><dd><a href={href} target="_blank" rel="noopener noreferrer">{children}</a></dd></div>;
}
