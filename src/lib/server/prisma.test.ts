import { describe, it, expect, vi, beforeEach } from "vitest";

const sessionTransaction = vi.fn();

vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: vi.fn(() => ({
    $transaction: sessionTransaction,
  })),
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({})),
}));

vi.mock("./env", () => ({
  env: {
    databaseUrl: () => "postgresql://user:pass@localhost:6543/db?pgbouncer=true",
    directDatabaseUrl: () => "postgresql://user:pass@localhost:5432/db",
  },
}));

describe("runPrismaTransaction", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionTransaction.mockReset();
    sessionTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<string>) =>
      fn({ kind: "session-tx" })
    );
  });

  it("delegates interactive transactions to the session Prisma client", async () => {
    const { runPrismaTransaction } = await import("./prisma");
    const result = await runPrismaTransaction(async (tx) => {
      expect(tx).toEqual({ kind: "session-tx" });
      return "ok";
    });
    expect(result).toBe("ok");
    expect(sessionTransaction).toHaveBeenCalledTimes(1);
  });
});
