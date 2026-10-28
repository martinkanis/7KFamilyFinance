/** Chyba, jejíž zprávu je bezpečné ukázat uživateli (vztahuje se k jeho vstupu). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) =>
  new HttpError(404, `${what} neexistuje`);

export const invalidInput = (message: string) => new HttpError(422, message);

const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";

function pgErrorCode(error: unknown): string | undefined {
  const candidate = (error as { cause?: { code?: unknown } })?.cause ?? error;
  const code = (candidate as { code?: unknown })?.code;
  return typeof code === "string" ? code : undefined;
}

/** Spustí zápis do DB a známé chyby integrity převede na srozumitelnou odpověď. */
export async function withDbErrors<T>(
  entity: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw translateDbError(error, entity);
  }
}

/** Převede porušení unikátnosti / cizího klíče na srozumitelnou 409/422. */
function translateDbError(error: unknown, entity: string): unknown {
  const code = pgErrorCode(error);
  if (code === PG_UNIQUE_VIOLATION) {
    return new HttpError(
      409,
      `${entity} se stejným názvem nebo ID už existuje`,
    );
  }
  if (code === PG_FOREIGN_KEY_VIOLATION) {
    return invalidInput(`${entity} odkazuje na záznam, který neexistuje`);
  }
  return error;
}
