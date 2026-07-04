import { beforeEach, describe, expect, it, vi } from "vitest";

const paymentIntentFindUnique = vi.fn();
const paymentIntentCreate = vi.fn();
const paymentIntentUpdate = vi.fn();
const registrationFindFirst = vi.fn();
const registrationCreate = vi.fn();
const runPrismaTransaction = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    paymentIntent: {
      findUnique: (...args: unknown[]) => paymentIntentFindUnique(...args),
      create: (...args: unknown[]) => paymentIntentCreate(...args),
      update: (...args: unknown[]) => paymentIntentUpdate(...args),
    },
    registration: {
      findFirst: (...args: unknown[]) => registrationFindFirst(...args),
      create: (...args: unknown[]) => registrationCreate(...args),
    },
  },
  runPrismaTransaction: (...args: unknown[]) => runPrismaTransaction(...args),
}));

vi.mock("@/lib/app-config", () => ({
  getAppConfig: () => ({ paymentsMode: "cashfree" }),
}));

import {
  createRegistrationAndPayment,
  ensurePendingPaymentIntent,
} from "./index";

describe("ensurePendingPaymentIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a PENDING intent when none exists", async () => {
    paymentIntentFindUnique.mockResolvedValueOnce(null);
    paymentIntentCreate.mockResolvedValueOnce({ id: "pi-new" });

    const id = await ensurePendingPaymentIntent({
      registrationId: "reg-1",
      amount: 1500,
      currency: "INR",
    });

    expect(id).toBe("pi-new");
    expect(paymentIntentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registrationId: "reg-1",
        provider: "CASHFREE",
        amount: 1500,
        currency: "INR",
        status: "PENDING",
      }),
    });
  });

  it("returns existing PENDING intent and refreshes amount", async () => {
    paymentIntentFindUnique.mockResolvedValueOnce({ id: "pi-pending", status: "PENDING" });
    paymentIntentUpdate.mockResolvedValueOnce({ id: "pi-pending" });

    const id = await ensurePendingPaymentIntent({
      registrationId: "reg-1",
      amount: 2000,
      currency: "INR",
    });

    expect(id).toBe("pi-pending");
    expect(paymentIntentUpdate).toHaveBeenCalledWith({
      where: { id: "pi-pending" },
      data: expect.objectContaining({ amount: 2000, currency: "INR" }),
    });
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("returns CONFIRMED intent without changes", async () => {
    paymentIntentFindUnique.mockResolvedValueOnce({ id: "pi-paid", status: "CONFIRMED" });

    const id = await ensurePendingPaymentIntent({
      registrationId: "reg-1",
      amount: 1500,
      currency: "INR",
    });

    expect(id).toBe("pi-paid");
    expect(paymentIntentUpdate).not.toHaveBeenCalled();
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("revives CANCELLED intent to PENDING and clears Cashfree reference", async () => {
    paymentIntentFindUnique.mockResolvedValueOnce({ id: "pi-old", status: "CANCELLED" });
    paymentIntentUpdate.mockResolvedValueOnce({ id: "pi-old" });

    const id = await ensurePendingPaymentIntent({
      registrationId: "reg-1",
      amount: 1800,
      currency: "INR",
    });

    expect(id).toBe("pi-old");
    expect(paymentIntentUpdate).toHaveBeenCalledWith({
      where: { id: "pi-old" },
      data: expect.objectContaining({
        status: "PENDING",
        provider: "CASHFREE",
        amount: 1800,
        currency: "INR",
        confirmedAt: null,
        confirmedByUserId: null,
        reference: null,
      }),
    });
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it("revives REFUNDED intent to PENDING", async () => {
    paymentIntentFindUnique.mockResolvedValueOnce({ id: "pi-refunded", status: "REFUNDED" });
    paymentIntentUpdate.mockResolvedValueOnce({ id: "pi-refunded" });

    const id = await ensurePendingPaymentIntent({
      registrationId: "reg-1",
      amount: 900,
      currency: "INR",
    });

    expect(id).toBe("pi-refunded");
    expect(paymentIntentUpdate).toHaveBeenCalledWith({
      where: { id: "pi-refunded" },
      data: expect.objectContaining({
        status: "PENDING",
        reference: null,
        amount: 900,
      }),
    });
  });
});

describe("createRegistrationAndPayment", () => {
  let txRegCreate: ReturnType<typeof vi.fn>;
  let txPiCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    registrationFindFirst.mockResolvedValue(null);
    txRegCreate = vi.fn().mockResolvedValue({ id: "reg-1" });
    txPiCreate = vi.fn().mockResolvedValue({ id: "pi-1", status: "PENDING" });
    runPrismaTransaction.mockImplementation(async (fn: (tx: {
      registration: { create: ReturnType<typeof vi.fn> };
      paymentIntent: { create: ReturnType<typeof vi.fn> };
    }) => Promise<unknown>) =>
      fn({
        registration: { create: txRegCreate },
        paymentIntent: { create: txPiCreate },
      })
    );
  });

  it("creates registration and payment intent in one transaction", async () => {
    const result = await createRegistrationAndPayment({
      registrationId: "reg-1",
      userId: "user-1",
      eventId: "evt-1",
      categoryName: "Delegate",
      formAnswersJson: '{"school":"Test"}',
      amount: 1000,
      currency: "INR",
    });

    expect(runPrismaTransaction).toHaveBeenCalledTimes(1);
    expect(txRegCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        formAnswersJson: '{"school":"Test"}',
        paid: false,
      }),
    });
    expect(txPiCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registrationId: "reg-1",
        provider: "CASHFREE",
        status: "PENDING",
      }),
    });
    expect(result).toMatchObject({
      registrationId: "reg-1",
      paymentIntentId: "pi-1",
      provider: "CASHFREE",
      paid: false,
      amount: 1000,
    });
  });

  it("defers payment without creating an intent for allot-first", async () => {
    registrationCreate.mockResolvedValueOnce({ id: "reg-deferred" });

    const result = await createRegistrationAndPayment({
      registrationId: "reg-deferred",
      userId: "user-1",
      eventId: "evt-1",
      categoryName: "Delegate",
      formAnswersJson: '{"school":"Test"}',
      amount: 1000,
      currency: "INR",
      deferPayment: true,
    });

    expect(runPrismaTransaction).not.toHaveBeenCalled();
    expect(registrationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "reg-deferred",
        paid: false,
        formAnswersJson: '{"school":"Test"}',
      }),
    });
    expect(result).toMatchObject({
      paymentIntentId: null,
      provider: "DEFERRED",
      deferredPayment: true,
      paid: false,
    });
  });
});
