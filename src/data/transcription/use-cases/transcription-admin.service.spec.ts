import { Test, TestingModule } from '@nestjs/testing';
import { TranscriptionAdminService } from './transcription-admin.service';
import { TRANSCRIPTION_ADMIN_TOKENS } from './transcription-admin.service';

const mockProviderRepo = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deactivateAll: jest.fn(),
  deactivateAllExcept: jest.fn(),
};

const mockCredentialRepo = {
  listByProvider: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockAiModelRepo = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('TranscriptionAdminService', () => {
  let service: TranscriptionAdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptionAdminService,
        {
          provide: TRANSCRIPTION_ADMIN_TOKENS.ProviderRepository,
          useValue: mockProviderRepo,
        },
        {
          provide: TRANSCRIPTION_ADMIN_TOKENS.ProviderCredentialRepository,
          useValue: mockCredentialRepo,
        },
        {
          provide: TRANSCRIPTION_ADMIN_TOKENS.AiModelRepository,
          useValue: mockAiModelRepo,
        },
      ],
    }).compile();

    service = module.get<TranscriptionAdminService>(TranscriptionAdminService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('listProviders', () => {
    it('deve delegar ao repositório de providers', async () => {
      const providers = [{ id: '1', name: 'OPENAI', isActive: true }];
      mockProviderRepo.list.mockResolvedValue(providers);

      const result = await service.listProviders();

      expect(mockProviderRepo.list).toHaveBeenCalledTimes(1);
      expect(result).toEqual(providers);
    });
  });

  describe('createProvider', () => {
    it('deve criar provider com valores padrão', async () => {
      const dto = { name: 'OPENAI' as const };
      const created = { id: '1', ...dto, isActive: true };
      mockProviderRepo.deactivateAll.mockResolvedValue(undefined);
      mockProviderRepo.create.mockResolvedValue(created);

      const result = await service.createProvider(dto);

      expect(mockProviderRepo.deactivateAll).toHaveBeenCalledTimes(1);
      expect(mockProviderRepo.create).toHaveBeenCalledWith({
        name: 'OPENAI',
        isActive: true,
      });
      expect(result).toEqual(created);
    });
  });

  describe('deleteProvider', () => {
    it('deve delegar delete ao repositório', async () => {
      mockProviderRepo.delete.mockResolvedValue(undefined);

      await service.deleteProvider('id-1');

      expect(mockProviderRepo.delete).toHaveBeenCalledWith('id-1');
    });
  });
});
