// Serves the live sludge page to a phone over Tailscale for the ?bench test, and quits once the phone posts its result.
//   node tools/art/diorama/phone_bench.mjs OUT.json [MINUTES=45]
// Binds only to this Mac's Tailscale address (tailnet devices only, nothing on the local Wi-Fi), changes no Tailscale settings.
import { createServer } from "vite";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [out = "bench.json", minutes = "45"] = process.argv.slice(2);
const ts = ["tailscale", "/Applications/Tailscale.app/Contents/MacOS/Tailscale"];
let host = "";
for (const bin of ts) { try { host = execFileSync(bin, ["ip", "-4"]).toString().trim().split("\n")[0]; break; } catch {} }
if (!host.startsWith("100.")) { console.error("no Tailscale address"); process.exit(2); }

const server = await createServer({
  server: { host, port: 5199, strictPort: true },
  plugins: [{
    name: "bench-result",
    configureServer(s) {
      s.middlewares.use("/__bench", (req, res) => {
        let body = "";
        req.on("data", c => (body += c));
        req.on("end", () => {
          writeFileSync(out, body);
          res.end("ok");
          console.log("RESULT", body);
          setTimeout(() => server.close().then(() => process.exit(0)), 500);
        });
      });
    },
  }],
});
await server.listen();
console.log(`open http://${host}:5199/live-sludge.html?dir=live-proof/L9/&bench`);
setTimeout(() => { console.log("timed out"); server.close().then(() => process.exit(1)); }, Number(minutes) * 60000);
