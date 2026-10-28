// QR Platba (formát SPD 1.0, standard České bankovní asociace) – čte ji My Air, ČSOB Smart i ostatní české banky.

interface CzechAccount {
  prefix: string;
  number: string;
  bankCode: string;
}

export interface SpdPayment {
  account: string | null;
  amount: number;
  vs: string | null;
  ks: string | null;
  ss: string | null;
  message: string | null;
  recipientName: string | null;
}

export type SpdResult =
  | { ok: true; spd: string; iban: string }
  | { ok: false; error: string };

const CZECH_ACCOUNT = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/;
const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const SYMBOL = /^\d{1,10}$/;
const PREFIX_WEIGHTS = [10, 5, 8, 4, 2, 1];
const NUMBER_WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];
const MAX_AMOUNT = 9_999_999.99;
const MAX_MESSAGE = 60;
const MAX_RECIPIENT = 35;
/** Číselný zápis „CZ00“ přesunutého na konec IBANu (C = 12, Z = 35). */
const CZ_SUFFIX = "123500";

function parseCzechAccount(raw: string): CzechAccount | null {
  const match = CZECH_ACCOUNT.exec(raw);
  if (!match?.[2] || !match[3]) {
    return null;
  }
  return {
    prefix: (match[1] ?? "").padStart(6, "0"),
    number: match[2].padStart(10, "0"),
    bankCode: match[3],
  };
}

function passesMod11(digits: string, weights: number[]): boolean {
  const sum = [...digits].reduce(
    (total, digit, i) => total + Number(digit) * (weights[i] ?? 0),
    0,
  );
  return sum % 11 === 0;
}

/** České číslo účtu musí projít kontrolou modulo 11 (předčíslí i základ). */
function isValidCzechAccount(account: CzechAccount): boolean {
  return (
    Number(account.number) > 0 &&
    passesMod11(account.prefix, PREFIX_WEIGHTS) &&
    passesMod11(account.number, NUMBER_WEIGHTS)
  );
}

function mod97(digits: string): number {
  return [...digits].reduce(
    (rest, digit) => (rest * 10 + Number(digit)) % 97,
    0,
  );
}

function czechIban(account: CzechAccount): string {
  const bban = `${account.bankCode}${account.prefix}${account.number}`;
  const checkDigits = 98 - mod97(`${bban}${CZ_SUFFIX}`);
  return `CZ${String(checkDigits).padStart(2, "0")}${bban}`;
}

function isValidIban(iban: string): boolean {
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const digits = [...rearranged]
    .map((char) => (/\d/.test(char) ? char : String(char.charCodeAt(0) - 55)))
    .join("");
  return mod97(digits) === 1;
}

type IbanResult = { ok: true; iban: string } | { ok: false; error: string };

export function resolveIban(rawAccount: string | null): IbanResult {
  const account = rawAccount?.replace(/\s/g, "").toUpperCase() ?? "";
  if (account === "") {
    return { ok: false, error: "Chybí účet protistrany" };
  }
  if (IBAN.test(account)) {
    return isValidIban(account)
      ? { ok: true, iban: account }
      : { ok: false, error: `IBAN ${account} nemá platný kontrolní součet` };
  }
  const czech = parseCzechAccount(account);
  if (!czech) {
    return {
      ok: false,
      error: `Účet „${rawAccount}“ nemá tvar předčíslí-číslo/kód banky`,
    };
  }
  if (!isValidCzechAccount(czech)) {
    return {
      ok: false,
      error: `Účet ${rawAccount} neprošel kontrolou (modulo 11) – nejspíš překlep`,
    };
  }
  return { ok: true, iban: czechIban(czech) };
}

/** Bez diakritiky a hvězdiček (oddělovač SPD), jen tisknutelné ASCII. */
function sanitize(text: string, maxLength: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function invalidSymbol(payment: SpdPayment): string | null {
  const symbols: [string, string | null][] = [
    ["VS", payment.vs],
    ["KS", payment.ks],
    ["SS", payment.ss],
  ];
  const invalid = symbols.find(
    ([, value]) => value != null && value !== "" && !SYMBOL.test(value),
  );
  return invalid
    ? `${invalid[0]} „${invalid[1]}“ musí být jen číslice (max. 10)`
    : null;
}

function optionalField(key: string, value: string | null): string[] {
  return value ? [`${key}:${value}`] : [];
}

export function buildSpd(payment: SpdPayment): SpdResult {
  const iban = resolveIban(payment.account);
  if (!iban.ok) {
    return iban;
  }
  if (!(payment.amount > 0) || payment.amount > MAX_AMOUNT) {
    return {
      ok: false,
      error: "Částka pro QR platbu musí být kladná a menší než 10 mil. Kč",
    };
  }
  const symbolError = invalidSymbol(payment);
  if (symbolError) {
    return { ok: false, error: symbolError };
  }
  const recipient = payment.recipientName
    ? sanitize(payment.recipientName, MAX_RECIPIENT)
    : null;
  const message = payment.message
    ? sanitize(payment.message, MAX_MESSAGE)
    : null;
  const fields = [
    "SPD",
    "1.0",
    `ACC:${iban.iban}`,
    `AM:${payment.amount.toFixed(2)}`,
    "CC:CZK",
    ...optionalField("RN", recipient),
    ...optionalField("MSG", message),
    ...optionalField("X-VS", payment.vs),
    ...optionalField("X-KS", payment.ks),
    ...optionalField("X-SS", payment.ss),
  ];
  return { ok: true, spd: fields.join("*"), iban: iban.iban };
}

export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}
