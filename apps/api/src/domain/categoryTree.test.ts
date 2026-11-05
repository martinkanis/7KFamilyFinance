import { describe, expect, it } from "bun:test";
import { moveNode, rootOf, treeOrder } from "./categoryTree.ts";

const node = (name: string, parent: string | null = null) => ({ name, parent });
const shape = (nodes: { name: string; parent: string | null }[]) =>
  treeOrder(nodes).map((n) => `${n.number} ${n.name}`);

describe("strom kategorií", () => {
  const nodes = [
    node("Byty"),
    node("Domácnost"),
    node("Byt Brno", "Byty"),
    node("Energie Brno", "Byt Brno"),
    node("Byt Praha", "Byty"),
  ];

  it("seřadí nadřazené před podkategorie a očísluje 1.1.1", () => {
    expect(shape(nodes)).toEqual([
      "1 Byty",
      "1.1 Byt Brno",
      "1.1.1 Energie Brno",
      "1.2 Byt Praha",
      "2 Domácnost",
    ]);
  });

  it("neznámá nadřazená kategorie a cyklus skončí na nejvyšší úrovni", () => {
    expect(
      shape([node("A", "Neexistuje"), node("B", "C"), node("C", "B")]),
    ).toEqual(["1 A", "2 B", "3 C"]);
  });

  it("najde kategorii nejvyšší úrovně", () => {
    expect(rootOf(nodes, "Energie Brno")).toBe("Byty");
    expect(rootOf(nodes, "Domácnost")).toBe("Domácnost");
  });

  it("přetažením do kategorie vznikne podkategorie (i s jejími podkategoriemi)", () => {
    expect(
      shape(moveNode(nodes, "Byt Brno", "Domácnost", "into") ?? []),
    ).toEqual([
      "1 Byty",
      "1.1 Byt Praha",
      "2 Domácnost",
      "2.1 Byt Brno",
      "2.1.1 Energie Brno",
    ]);
  });

  it("před/za jinou kategorii se stane jejím sourozencem", () => {
    expect(shape(moveNode(nodes, "Byt Praha", "Byty", "before") ?? [])).toEqual(
      [
        "1 Byt Praha",
        "2 Byty",
        "2.1 Byt Brno",
        "2.1.1 Energie Brno",
        "3 Domácnost",
      ],
    );
    expect(
      shape(moveNode(nodes, "Domácnost", "Byt Brno", "after") ?? []),
    ).toEqual([
      "1 Byty",
      "1.1 Byt Brno",
      "1.1.1 Energie Brno",
      "1.2 Domácnost",
      "1.3 Byt Praha",
    ]);
  });

  it("kategorii nejde přesunout do vlastní podkategorie", () => {
    expect(moveNode(nodes, "Byty", "Energie Brno", "into")).toBeNull();
    expect(moveNode(nodes, "Byty", "Byty", "into")).toBeNull();
  });
});
