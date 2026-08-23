import { dirname, join } from "node:path";
import { hostname } from "node:os";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import express from "express";
import wisp from "wisp-server-node";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const app = express();
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicPath = join(projectRoot, "public");
const workspacePath = join(projectRoot, "..", "..");
const cherriPath = join(workspacePath, "cherri-cloudflare-main (1)", "cherri-cloudflare-main");
// Load our publicPath first and prioritize it over UV.
app.use(express.static(workspacePath));
app.use(express.static(publicPath));
app.use(express.static(cherriPath));
app.use("/Ultraviolet-App-main/", express.static(publicPath));
// Load vendor files last.
// The vendor's uv.config.js won't conflict with our uv.config.js inside the publicPath directory.
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

// Error for everything else
app.use((req, res) => {
	res.status(404);
	res.sendFile(join(publicPath, "404.html"));
});

const server = createServer();

server.on("request", (req, res) => {
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	app(req, res);
});
server.on("upgrade", (req, socket, head) => {
	try {
		if (req.url?.endsWith("/wisp/")) {
			wisp.routeRequest(req, socket, head);
			return;
		}
	} catch (error) {
		console.error("Wisp connection failed:", error);
	}
	if (!socket.destroyed) socket.destroy();
});

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

server.on("listening", () => {
	const address = server.address();

	// by default we are listening on 0.0.0.0 (every interface)
	// we just need to list a few
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

// https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	server.close();
	process.exit(0);
}

server.listen({
	port,
});
