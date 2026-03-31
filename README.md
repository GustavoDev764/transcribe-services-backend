# VidWave Backend

Sistema de transcrição de áudio MP3 para SRT com integração OpenAI e Google Speech. Desenvolvido em NestJS com padrão DDD (Domain-Driven Design).

## Funcionalidades

- **Autenticação**: Login e criação de conta (cliente e administrador)
- **Dashboard**: Tabela de arquivos recentes com upload, transcrição e download SRT
- **Pastas**: Criação de pastas para organizar arquivos (um nível, sem subpastas)
- **Transcrição**: Conversão MP3 → SRT via OpenAI Whisper ou Google Speech
- **Integrações IA**: Múltiplas credenciais OpenAI/Google, fallback automático ao esgotar tokens
- **Permissões**: `folder:write`, `upload:write`, `generate_srt:write`, `manage:users`, `manage:ai`
- **Perfis**: Cliente e Manager (admin com painel próprio)

## Setup

### Pré-requisitos

- Node.js 18+
- PostgreSQL
- npm ou yarn

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e configure:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/vidwave?schema=public"
JWT_SECRET="sua-chave-secreta-muito-segura"
JWT_EXPIRES_IN="7d"
UPLOAD_PATH="./uploads"
STORAGE_PATH="./storage"

# Opcional - para seed do primeiro admin
MANAGER_EMAIL="admin@vidwave.com"
MANAGER_PASSWORD="admin123"
```

### 3. Banco de dados

```bash
# Criar banco e tabelas (Prisma 7)
npx prisma db push

# Gerar cliente Prisma
npm run prisma:generate

# Criar primeiro administrador
npm run prisma:seed
```

### Usuários do seed

O `prisma/seed.ts` cria **apenas um usuário**: o **Manager** (administrador), com perfil `MANAGER` e permissões de pasta, upload, SRT, gestão de usuários e gestão de IA.

As credenciais vêm das variáveis `MANAGER_EMAIL` e `MANAGER_PASSWORD` no `.env`. Se não estiverem definidas, o seed usa estes **valores padrão**:

| Campo    | Valor padrão (sem `.env`)   |
| -------- | --------------------------- |
| E-mail   | `gustavojose321@gmail.com`  |
| Senha    | `react8129`                 |
| Nome     | `Gustavo`                   |

**Login no sistema:** use `POST /auth/manager/login` com `email` e `password` (não use a rota de login de cliente).

Altere obrigatoriamente e-mail e senha em produção definindo `MANAGER_EMAIL` e `MANAGER_PASSWORD` antes de rodar o seed (ou atualize o usuário depois pelo fluxo do produto).

### 4. Executar

```bash
# Desenvolvimento
npm run start:dev

# Produção
npm run build
npm run start:prod
```

A aplicação estará em `http://localhost:3000`. O frontend (HTML + Tailwind) é servido em `/`.

## Rotas da API

### Autenticação (públicas)
- `POST /auth/register` - Criar conta (cliente)
- `POST /auth/login` - Login cliente
- `POST /auth/manager/login` - Login administrador

### Autenticação (protegidas)
- `POST /auth/me` - Dados do usuário logado

### Pastas
- `GET /folders` - Listar pastas
- `POST /folders` - Criar pasta
- `GET /folders/:id` - Detalhes da pasta
- `PUT /folders/:id` - Atualizar pasta
- `DELETE /folders/:id` - Excluir pasta

### Arquivos
- `GET /files/recent` - Arquivos recentes
- `GET /files/folder/:folderId` - Arquivos da pasta
- `POST /files/upload` - Upload único
- `POST /files/upload-multiple` - Upload múltiplo
- `GET /files/:id` - Detalhes
- `GET /files/:id/srt` - Download SRT
- `DELETE /files/:id` - Excluir

### Transcrição
- `POST /transcription/file/:fileId` - Transcrever arquivo

### Admin (somente Manager)
- `GET /admin/dashboard` - Dashboard admin
- `GET /ai-integrations` - Listar integrações
- `POST /ai-integrations` - Adicionar integração
- `PUT /ai-integrations/:id` - Atualizar
- `DELETE /ai-integrations/:id` - Remover

## Integrações de IA

O Manager configura as integrações em **Integrações IA** no painel admin:

- **OpenAI**: Chave da API (Whisper)
- **Google Speech**: Caminho do JSON de credenciais ou chave (configurar conforme SDK)

O sistema tenta cada integração por ordem de prioridade. Ao esgotar tokens de uma, migra automaticamente para a próxima.

## Modos de transcrição

- **Chita** - Mais rápido
- **Golfinho** - Equilibrado
- **Baleia** - Maior precisão

## Estrutura DDD

```
src/
├── shared/           # Kernel e infraestrutura compartilhada
│   ├── kernel/       # Permissões, constantes
│   └── infrastructure/prisma/
├── modules/
│   ├── auth/         # Autenticação e autorização
│   ├── folder/       # Pastas
│   ├── file/         # Arquivos e upload
│   ├── ai-integration/ # Credenciais de IA
│   ├── transcription/  # Serviço de transcrição
│   └── admin/        # Painel do administrador
└── main.ts
```

## Licença

UNLICENSED
