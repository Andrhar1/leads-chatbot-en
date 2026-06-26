import { describe, it, expect } from "vitest";
import { nextAction } from "../src/conversation/engine.js";
import type { Lead } from "../src/types.js";

function lead(p: Partial<Lead>): Lead {
  return {
    id: 1, waChatId: "x", personName: null, companyName: null, industry: null,
    legalNeed: null, status: "collecting", confidence: null, needsReview: false,
    createdAt: "", updatedAt: "", ...p,
  };
}

const CLOSING = "Thank you for the information. Our team will reach out to you shortly. 🙏";

describe("nextAction", () => {
  it("handover when core is complete & confidence >= 0.6", () => {
    const a = nextAction(lead({ personName: "John", industry: "Technology", legalNeed: "Intellectual Property", confidence: 0.8 }), 2);
    expect(a.newStatus).toBe("ready_for_handover");
    expect(a.reply).toBe(CLOSING);
  });

  it("keeps asking when confidence < 0.6 even if core is filled", () => {
    const a = nextAction(lead({ personName: "John", industry: "Technology", legalNeed: "Intellectual Property", confidence: 0.4 }), 2);
    expect(a.newStatus).toBe("collecting");
    expect(a.reply).toBeTruthy();
  });

  it("forces handover on the 4th turn even when info is missing", () => {
    const a = nextAction(lead({}), 4);
    expect(a.newStatus).toBe("ready_for_handover");
    expect(a.reply).toBe(CLOSING);
  });

  it("asks for name/company when both are empty", () => {
    const a = nextAction(lead({}), 1);
    expect(a.newStatus).toBe("collecting");
    expect(a.reply).toMatch(/name|company/i);
  });

  it("asks for the legal need when identity exists but legalNeed is empty", () => {
    const a = nextAction(lead({ personName: "John", industry: "Technology" }), 2);
    expect(a.reply).toMatch(/legal|help/i);
  });
});
