import type { Prisma, PrismaClient } from "@prisma/client";

/** Either the shared client or an interactive-transaction client. */
export type DbClient = PrismaClient | Prisma.TransactionClient;
