import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
// Next/webpack may exit zero even when it emitted an unresolved-export warning.
// Treat every compile warning as a failed build, not merely an observation in a log.
const output = createWriteStream("production-build.log");
const child = spawn("npm", ["run", "build"], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
let text = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
  const s = chunk.toString(); text += s; output.write(s); process.stdout.write(s);
});
child.on("error", (error) => { console.error(error); process.exitCode = 1; });
child.on("close", (code) => {
  output.end();
  const bad = /Attempted import error|Compiled with warnings|export .* was not found|is not exported from|Module not found|Can't resolve|Module build failed|Failed to compile|Module parse failed/i.test(text);
  if (code !== 0 || bad) {
    console.error("Production build rejected: nonzero exit or compile/import/export warning.");
    process.exitCode = 1;
  }
});
