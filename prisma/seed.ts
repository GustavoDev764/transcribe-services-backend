import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { resolveDatabaseUrl } from '../src/config/resolve-database-url.js';

const connectionString = resolveDatabaseUrl();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const managerEmail = process.env.MANAGER_EMAIL || 'gustavojose321@gmail.com';
  const managerPassword = process.env.MANAGER_PASSWORD || 'react8129';

  const hash = await bcrypt.hash(managerPassword, 10);

  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: { passwordHash: hash, name: 'Gustavo' },
    create: {
      email: managerEmail,
      passwordHash: hash,
      name: 'Gustavo',
      profile: 'MANAGER',
      permissions: [
        'folder:write',
        'upload:write',
        'generate_srt:write',
        'manage:users',
        'manage:ai',
      ],
    },
  });

  console.log('Manager criado:', manager.email);

  const openAiProvider = await prisma.provider.upsert({
    where: { name: 'OPENAI' },
    update: {},
    create: { name: 'OPENAI' },
  });
  const googleProvider = await prisma.provider.upsert({
    where: { name: 'GOOGLE_SPEECH' },
    update: {},
    create: { name: 'GOOGLE_SPEECH' },
  });

  await prisma.provider.upsert({
    where: { name: 'TRANSCRIBE_SERVICES' },
    update: {},
    create: { name: 'TRANSCRIBE_SERVICES', isActive: false },
  });

  await Promise.all([
    prisma.aiModel.upsert({
      where: { id: 'openai-fast' },
      update: {
        providerId: openAiProvider.id,
        name: 'OpenAI Fast',
        modelName: 'gpt-4o-mini-transcribe',
        type: 'TRANSCRIPTION',
        isActive: true,
      },
      create: {
        id: 'openai-fast',
        providerId: openAiProvider.id,
        name: 'OpenAI Fast',
        modelName: 'gpt-4o-mini-transcribe',
        type: 'TRANSCRIPTION',
      },
    }),
    prisma.aiModel.upsert({
      where: { id: 'openai-accurate' },
      update: {
        providerId: openAiProvider.id,
        name: 'OpenAI Accurate',
        modelName: 'gpt-4o-transcribe',
        type: 'TRANSCRIPTION',
        isActive: true,
      },
      create: {
        id: 'openai-accurate',
        providerId: openAiProvider.id,
        name: 'OpenAI Accurate',
        modelName: 'gpt-4o-transcribe',
        type: 'TRANSCRIPTION',
      },
    }),
  ]);

  await Promise.all([
    prisma.aiModel.upsert({
      where: { id: 'google-fast' },
      update: {
        providerId: googleProvider.id,
        name: 'Google Fast',
        modelName: 'latest_short',
        type: 'TRANSCRIPTION',
        isActive: true,
      },
      create: {
        id: 'google-fast',
        providerId: googleProvider.id,
        name: 'Google Fast',
        modelName: 'latest_short',
        type: 'TRANSCRIPTION',
      },
    }),
    prisma.aiModel.upsert({
      where: { id: 'google-accurate' },
      update: {
        providerId: googleProvider.id,
        name: 'Google Accurate',
        modelName: 'latest_long',
        type: 'TRANSCRIPTION',
        isActive: true,
      },
      create: {
        id: 'google-accurate',
        providerId: googleProvider.id,
        name: 'Google Accurate',
        modelName: 'latest_long',
        type: 'TRANSCRIPTION',
      },
    }),
  ]);

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
