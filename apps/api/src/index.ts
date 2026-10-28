import { config } from "./config.ts";
import { pool, runMigrations } from "./db/index.ts";
import { configuredUserCount } from "./modules/auth/service.ts";
import { app } from "./server.ts";

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.log(`Přijat ${signal}, ukončuji…`);
    await app.stop();
    await pool.end();
    process.exit(0);
  });
}

await runMigrations();

if (configuredUserCount() === 0) {
  console.warn(
    "AUTH_USERS je prázdné – nikdo se nepřihlásí. Vygeneruj hash: bun run auth:hash-password",
  );
}

app.listen(config.port);
console.log(`7KFamilyFinance běží na portu ${config.port}`);
