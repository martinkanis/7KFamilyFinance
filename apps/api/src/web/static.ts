import { normalize, resolve, sep } from "node:path";
import { config } from "../config.ts";

const ASSET_CACHE = "public, max-age=31536000, immutable";
const INDEX_CACHE = "no-cache";

function decodePath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function fileInsideWebRoot(pathname: string): string | null {
  const decoded = decodePath(pathname);
  if (decoded == null) {
    return null;
  }
  const root = resolve(config.webDistDir);
  const candidate = resolve(root, `.${normalize(decoded)}`);
  return candidate.startsWith(root + sep) ? candidate : null;
}

/** Statické soubory webu; neznámé cesty dostanou index.html (routing řeší SPA). */
export async function serveWeb(pathname: string): Promise<Response> {
  const path = fileInsideWebRoot(pathname);
  const file = path ? Bun.file(path) : null;
  if (file && (await file.exists())) {
    const cache = pathname.startsWith("/assets/") ? ASSET_CACHE : INDEX_CACHE;
    return new Response(file, { headers: { "cache-control": cache } });
  }
  const index = Bun.file(resolve(config.webDistDir, "index.html"));
  if (!(await index.exists())) {
    return new Response("Web není sestavený (bun run build)", { status: 503 });
  }
  return new Response(index, { headers: { "cache-control": INDEX_CACHE } });
}
