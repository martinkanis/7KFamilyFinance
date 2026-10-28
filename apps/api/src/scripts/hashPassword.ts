// Vygeneruje položku do AUTH_USERS: `bun run auth:hash-password [jmeno]`.
// Heslo se zadává skrytě a nikam se neukládá; vypíše se jen jeho hash.
import { encodePasswordHash } from "../modules/auth/users.ts";

const MIN_PASSWORD_LENGTH = 10;
const ENTER = new Set(["\r", "\n"]);
const BACKSPACE = new Set(["\u007f", "\b"]);
const CTRL_C = "\u0003";

function readHiddenLine(label: string): Promise<string> {
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString()) {
        if (char === CTRL_C) {
          process.exit(130);
        }
        if (ENTER.has(char)) {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        value = BACKSPACE.has(char) ? value.slice(0, -1) : value + char;
      }
    };
    process.stdin.on("data", onData);
  });
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const username = (process.argv[2] ?? prompt("Jméno:") ?? "")
  .trim()
  .toLowerCase();
if (!/^[a-z0-9._-]+$/.test(username)) {
  fail("Jméno smí obsahovat jen písmena bez diakritiky, číslice, . _ -");
}

const password = await readHiddenLine("Heslo: ");
if (password.length < MIN_PASSWORD_LENGTH) {
  fail(`Heslo musí mít aspoň ${MIN_PASSWORD_LENGTH} znaků`);
}
if ((await readHiddenLine("Heslo znovu: ")) !== password) {
  fail("Hesla se neshodují");
}

const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
console.log("\nPřidej do AUTH_USERS (více uživatelů odděl čárkou):");
console.log(`${username}:${encodePasswordHash(hash)}`);
