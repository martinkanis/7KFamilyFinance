import { describe, expect, it } from "bun:test";
import { buildSpd, resolveIban, type SpdPayment } from "./spd.ts";

const payment: SpdPayment = {
  account: "19-2000145399/0800",
  amount: 480.5,
  vs: "1234567890",
  ks: "0308",
  ss: null,
  message: "Platba za zboží * leden",
  recipientName: "Pražská energetika",
};

describe("IBAN z českého účtu", () => {
  it("odpovídá vzorovému příkladu ze standardu", () => {
    expect(resolveIban("19-2000145399/0800")).toEqual({
      ok: true,
      iban: "CZ6508000000192000145399",
    });
  });

  it("přijme účet bez předčíslí i s mezerami", () => {
    const result = resolveIban(" 2000145399 / 0800 ");
    expect(result.ok).toBe(true);
  });

  it("odhalí překlep kontrolou modulo 11", () => {
    const result = resolveIban("19-2000145398/0800");
    expect(result.ok).toBe(false);
  });

  it("ověří zadaný IBAN", () => {
    expect(resolveIban("CZ65 0800 0000 1920 0014 5399").ok).toBe(true);
    expect(resolveIban("CZ66 0800 0000 1920 0014 5399").ok).toBe(false);
  });

  it("hlásí chybějící účet", () => {
    expect(resolveIban(null)).toEqual({
      ok: false,
      error: "Chybí účet protistrany",
    });
  });
});

describe("SPD řetězec", () => {
  it("sestaví platbu bez diakritiky a hvězdiček ve zprávě", () => {
    expect(buildSpd(payment)).toEqual({
      ok: true,
      iban: "CZ6508000000192000145399",
      spd: "SPD*1.0*ACC:CZ6508000000192000145399*AM:480.50*CC:CZK*RN:Prazska energetika*MSG:Platba za zbozi leden*X-VS:1234567890*X-KS:0308",
    });
  });

  it("odmítne nečíselný VS a nulovou částku", () => {
    expect(buildSpd({ ...payment, vs: "12-34" }).ok).toBe(false);
    expect(buildSpd({ ...payment, amount: 0 }).ok).toBe(false);
  });
});
