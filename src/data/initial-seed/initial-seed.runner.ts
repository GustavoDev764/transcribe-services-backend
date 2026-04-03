import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export type InitialSeedDb = Pick<
  PrismaClient,
  'user' | 'provider' | 'aiModel'
>;

export async function runInitialSeed(
  db: InitialSeedDb,
  opts: { managerEmail: string; managerPassword: string },
): Promise<void> {
  const hash = await bcrypt.hash(opts.managerPassword, 10);

  await db.user.upsert({
    where: { email: opts.managerEmail },
    update: { passwordHash: hash, name: 'Gustavo' },
    create: {
      email: opts.managerEmail,
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

  const openAiProvider = await db.provider.upsert({
    where: { name: 'OPENAI' },
    update: {},
    create: { name: 'OPENAI' },
  });
  const googleProvider = await db.provider.upsert({
    where: { name: 'GOOGLE_SPEECH' },
    update: {},
    create: { name: 'GOOGLE_SPEECH' },
  });

  await db.provider.upsert({
    where: { name: 'TRANSCRIBE_SERVICES' },
    update: {},
    create: { name: 'TRANSCRIBE_SERVICES', isActive: false },
  });

  await Promise.all([
    db.aiModel.upsert({
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
    db.aiModel.upsert({
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
    db.aiModel.upsert({
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
    db.aiModel.upsert({
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
