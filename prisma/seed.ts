import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { resolveDatabaseUrl } from './database-url';
import { runInitialSeed } from '../src/data/initial-seed/initial-seed.runner';
import { SYSTEM_CONFIG_KEYS } from '../src/data/system-config/system-config-keys';

async function main() {
  const managerEmail = process.env.MANAGER_EMAIL?.trim() ?? '';
  const managerPassword = process.env.MANAGER_PASSWORD?.trim() ?? '';

  if (managerEmail === '' || managerPassword === '') {
    console.log(
      'Seed ignorado: defina MANAGER_EMAIL e MANAGER_PASSWORD no ambiente.',
    );
    return;
  }

  const connectionString = resolveDatabaseUrl();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await runInitialSeed(prisma, { managerEmail, managerPassword });

    const key = SYSTEM_CONFIG_KEYS.INITIAL_SEED_COMPLETED;
    const existing = await prisma.systemConfig.findUnique({ where: { id: key } });
    if (!existing) {
      await prisma.systemConfig.create({
        data: {
          id: key,
          value: JSON.stringify({
            completedAt: new Date().toISOString(),
            source: 'prisma-cli',
          }),
        },
      });
    }

    console.log('Manager e dados iniciais aplicados.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
