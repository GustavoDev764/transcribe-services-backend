import type { PrismaClient } from '@prisma/client';

/**
 * Tipo do cliente de banco de dados.
 * Atualmente implementado por PrismaDatabaseAdapter.
 * Para trocar de ORM, altere este tipo e a implementação do adapter.
 */
export type DatabaseClient = PrismaClient;
