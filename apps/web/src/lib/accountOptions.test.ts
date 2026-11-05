import { describe, expect, it } from "bun:test";
import type { Account, Counterparty } from "@kkff/api/contracts";
import { counterpartyAccountOptions, filterOptions } from "./accountOptions.ts";

const counterparty = (name: string, accountNumber: string | null) =>
  ({ id: 1, name, accountNumber }) as Counterparty;

describe("výběr účtu protistrany", () => {
  const options = counterpartyAccountOptions(
    [
      counterparty("Allianz", "2700/2700"),
      counterparty("ČEZ", "35-4544720217/0100"),
      counterparty("Bez účtu", null),
    ],
    [{ name: "Spořák", number: "123/3030" } as Account],
  );

  it("nabídne protistrany s účtem a naše účty, seřazené podle názvu", () => {
    expect(options.map((o) => o.label)).toEqual([
      "Allianz",
      "ČEZ",
      "Spořák (náš účet)",
    ]);
  });

  it("filtruje podle názvu i čísla, bez ohledu na diakritiku", () => {
    expect(filterOptions(options, "alli").map((o) => o.label)).toEqual([
      "Allianz",
    ]);
    expect(filterOptions(options, "cez").map((o) => o.label)).toEqual(["ČEZ"]);
    expect(filterOptions(options, "/0100").map((o) => o.label)).toEqual([
      "ČEZ",
    ]);
    expect(filterOptions(options, "náš 3030")).toHaveLength(1);
    expect(filterOptions(options, "")).toHaveLength(3);
  });
});
