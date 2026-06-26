import { describe, it, expect } from "vitest";
import { makeClassifier } from "../src/classifier/classifier.js";

function fakeClient(content: string | null) {
  return { chat: { completions: { create: async () => ({ choices: [{ message: { content } }] }) } } };
}

describe("classifier", () => {
  it("returns a valid Classification", async () => {
    const client = fakeClient(JSON.stringify({
      industry: "Technology", legalNeed: "Intellectual Property",
      personName: "John", companyName: "Acme Corp", confidence: 0.9,
    }));
    const classify = makeClassifier(client as any);
    const r = await classify("Hi, I'm John from Acme Corp, I'd like to register a trademark");
    expect(r).toEqual({ industry: "Technology", legalNeed: "Intellectual Property", personName: "John", companyName: "Acme Corp", confidence: 0.9 });
  });

  it("industry & legalNeed may be null when not yet mentioned", async () => {
    const client = fakeClient(JSON.stringify({
      industry: null, legalNeed: null, personName: "John", companyName: null, confidence: 0.3,
    }));
    const classify = makeClassifier(client as any);
    const r = await classify("Hi, I'm John");
    expect(r).toEqual({ industry: null, legalNeed: null, personName: "John", companyName: null, confidence: 0.3 });
  });

  it("null when enum is invalid", async () => {
    const client = fakeClient(JSON.stringify({
      industry: "Astronaut", legalNeed: "Intellectual Property", personName: null, companyName: null, confidence: 0.5,
    }));
    const classify = makeClassifier(client as any);
    expect(await classify("...")).toBeNull();
  });

  it("null when not JSON", async () => {
    const classify = makeClassifier(fakeClient("sorry I can't") as any);
    expect(await classify("...")).toBeNull();
  });

  it("null when content is empty", async () => {
    const classify = makeClassifier(fakeClient(null) as any);
    expect(await classify("...")).toBeNull();
  });
});
