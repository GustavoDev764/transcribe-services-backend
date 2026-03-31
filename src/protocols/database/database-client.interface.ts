/**
 * Token para injeção do cliente de banco de dados.
 * Permite trocar a implementação (ex: Prisma por TypeORM) sem alterar o restante do código.
 */
export const DATABASE_CLIENT = Symbol('DatabaseClient');
