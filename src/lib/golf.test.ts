import { describe, expect, it } from "vitest";
import { computeBalance, computeUnpaid, loginIdToEmail, normalizePhone, penaltyFor, scoreStats } from "./golf";

describe("penalty", () => {
  it("<=9 over par is free", () => { expect(penaltyFor(9)).toBe(0); expect(penaltyFor(-2)).toBe(0); });
  it("10-19 is 10,000", () => { expect(penaltyFor(10)).toBe(10000); expect(penaltyFor(19)).toBe(10000); });
  it("20-29 is 20,000", () => { expect(penaltyFor(23)).toBe(20000); });
  it("30-39 is 30,000", () => { expect(penaltyFor(39)).toBe(30000); });
});

describe("phone", () => {
  it("normalizes formats", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone("+82 10 1234 5678")).toBe("01012345678");
    expect(normalizePhone("011-123-4567")).toBeNull();
  });
  it("admin id maps to owner account only", () => {
    expect(loginIdToEmail("admin")).toBe("owner@admin.birdiejangbu.app");
    expect(loginIdToEmail("010 1234 5678")).toBe("01012345678@phone.birdiejangbu.app");
    expect(loginIdToEmail("정동성")).toBeNull();
  });
});

describe("ledger", () => {
  it("balance counts only real non-voided money, not charges", () => {
    const b = computeBalance([
      { kind: "income", amount: 20000, voided_at: null },
      { kind: "income", amount: 10000, voided_at: "2026-01-01" },
      { kind: "expense", amount: 5000, voided_at: null },
    ]);
    expect(b.balance).toBe(15000);
  });
  it("unpaid sums only charges without payment", () => {
    expect(computeUnpaid([{ penalty: 20000, payment_entry_id: null }, { penalty: 10000, payment_entry_id: "x" }])).toBe(20000);
  });
  it("stats", () => { expect(scoreStats([20, 10, 15])).toEqual({ count: 3, avg: 15, best: 10 }); });
});

