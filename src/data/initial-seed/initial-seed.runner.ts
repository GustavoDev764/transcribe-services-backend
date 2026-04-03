import type { PrismaClient } from '@prisma/client';
import { ProviderName } from '@app/domain/transcription/value-objects/provider-name';
import * as bcrypt from 'bcrypt';

const IA_CATEGORY_SPEECH_TO_TEXT_ID = 'c0000000-0000-4000-8000-000000000001';

export type InitialSeedDb = Pick<
  PrismaClient,
  'user' | 'provider' | 'aiModel' | 'iaCategory'
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

  /** Categoria tipo text_generation: modelos listados no cliente para escolha de transcrição. */
  const speechCategory = await db.iaCategory.upsert({
    where: { id: IA_CATEGORY_SPEECH_TO_TEXT_ID },
    update: {
      name: 'speech to text',
      tipo: 'TEXT_GENERATION',
    },
    create: {
      id: IA_CATEGORY_SPEECH_TO_TEXT_ID,
      name: 'speech to text',
      tipo: 'TEXT_GENERATION',
    },
  });

  const openAiProvider = await db.provider.upsert({
    where: { name: ProviderName.OPENAI },
    update: { displayName: 'OpenIA' },
    create: { name: ProviderName.OPENAI, displayName: 'OpenIA' },
  });
  const googleProvider = await db.provider.upsert({
    where: { name: ProviderName.GOOGLE },
    update: { displayName: 'Google' },
    create: { name: ProviderName.GOOGLE, displayName: 'Google' },
  });

  await db.provider.upsert({
    where: { name: ProviderName.TRANSCRIBE_SERVICES },
    update: { displayName: 'Transcribe services' },
    create: {
      name: ProviderName.TRANSCRIBE_SERVICES,
      displayName: 'Transcribe services',
      isActive: false,
    },
  });

  await Promise.all([
    db.aiModel.upsert({
      where: { id: 'openai-fast' },
      update: {
        providerId: openAiProvider.id,
        categoryId: speechCategory.id,
        name: 'OpenAI Fast',
        modelName: 'gpt-4o-mini-transcribe',
        type: 'TRANSCRIPTION',
        isActive: true,
      },
      create: {
        id: 'openai-fast',
        providerId: openAiProvider.id,
        categoryId: speechCategory.id,
        name: 'OpenAI Fast',
        modelName: 'gpt-4o-mini-transcribe',
        type: 'TRANSCRIPTION',
      },
    }),
    db.aiModel.upsert({
      where: { id: 'openai-accurate' },
      update: {
        providerId: openAiProvider.id,
        categoryId: speechCategory.id,
        name: 'OpenAI Accurate',
        modelName: 'gpt-4o-transcribe',
        type: 'TRANSCRIPTION',
        isActive: true,
      },
      create: {
        id: 'openai-accurate',
        providerId: openAiProvider.id,
        categoryId: speechCategory.id,
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
        categoryId: speechCategory.id,
        name: 'Google Fast',
        modelName: 'latest_short',
        type: 'TRANSCRIPTION',
        isActive: true,
      },
      create: {
        id: 'google-fast',
        providerId: googleProvider.id,
        categoryId: speechCategory.id,
        name: 'Google Fast',
        modelName: 'latest_short',
        type: 'TRANSCRIPTION',
      },
    }),
    db.aiModel.upsert({
      where: { id: 'google-accurate' },
      update: {
        providerId: googleProvider.id,
        categoryId: speechCategory.id,
        name: 'Google Accurate',
        modelName: 'latest_long',
        type: 'TRANSCRIPTION',
        isActive: true,
      },
      create: {
        id: 'google-accurate',
        providerId: googleProvider.id,
        categoryId: speechCategory.id,
        name: 'Google Accurate',
        modelName: 'latest_long',
        type: 'TRANSCRIPTION',
      },
    }),
  ]);
}
