// Serves the live sludge page to a phone over Tailscale for the ?bench test, and quits once the phone posts its result.
//   node tools/art/diorama/phone_bench.mjs OUT.json [MINUTES=45] [--wifi] [--results=N] [--next=a|b]
// Binds only to this Mac's Tailscale address (tailnet devices only, nothing on the local Wi-Fi), changes no Tailscale settings.
import { createServer } from "vite";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const lan = process.argv.includes("--wifi");
// --results=N: wait for N results (a ?benchnext run posts one a variant); they're saved as a JSON list
const want = Number((process.argv.find(a => a.startsWith("--results=")) ?? "--results=1").split("=")[1]);
const [out = "bench.json", minutes = "45"] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const got = [];
const nextArg = process.argv.find(a => a.startsWith("--next="))?.slice(7);
const benchPath = "/live-sludge.html?dir=live-proof/L9/&bench" + (nextArg ? "&benchnext=" + encodeURIComponent(nextArg) : "");
const ts = ["tailscale", "/Applications/Tailscale.app/Contents/MacOS/Tailscale"];
let host = "";
for (const bin of ts) { try { host = execFileSync(bin, ["ip", "-4"]).toString().trim().split("\n")[0]; break; } catch {} }
// --wifi: the home Wi-Fi address instead, for a phone not on this Mac's tailnet (anyone on that Wi-Fi can open it)
if (lan) host = execFileSync("ipconfig", ["getifaddr", "en0"]).toString().trim();
else if (!host.startsWith("100.")) { console.error("no Tailscale address"); process.exit(2); }

const server = await createServer({
  server: { host, port: 5199, strictPort: true },
  plugins: [{
    name: "bench-result",
    configureServer(s) {
      // /b: a short address to type on the phone, forwarding to the bench page
      s.middlewares.use((req, res, next) => {
        if (req.url !== "/b") return next();
        res.statusCode = 302; res.setHeader("location", benchPath); res.end();
      });
      s.middlewares.use("/__bench", (req, res) => {
        let body = "";
        req.on("data", c => (body += c));
        req.on("end", () => {
          got.push(JSON.parse(body));
          writeFileSync(out, JSON.stringify(got, null, 1));
          res.end("ok");
          console.log("RESULT", body);
          if (got.length >= want) setTimeout(() => server.close().then(() => process.exit(0)), 500);
        });
      });
    },
  }],
});
await server.listen();
console.log(`open http://${host}:5199/b (${benchPath})`);
setTimeout(() => { console.log("timed out"); server.close().then(() => process.exit(1)); }, Number(minutes) * 60000);
