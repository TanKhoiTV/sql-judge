import { readdirSync, statSync, createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";
import { join, extname } from "node:path";
import { pipeline } from "node:stream/promises";

const PUBLIC = new URL("../public", import.meta.url).pathname;
const EXTS = new Set([".html", ".css", ".js", ".json", ".svg"]);
const promises: Promise<void>[] = [];

function walk(dir: string): void {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		const st = statSync(p);
		if (st.isDirectory()) {
			walk(p);
		} else if (st.isFile() && EXTS.has(extname(name)) && !name.endsWith(".gz")) {
			const gzPath = p + ".gz";
			promises.push(
				pipeline(
					createReadStream(p),
					createGzip({ level: 9 }),
					createWriteStream(gzPath),
				),
			);
		}
	}
}

walk(PUBLIC);
await Promise.all(promises);
console.log(`Gzipped ${promises.length} static assets.`);
