# Arquitetura DDD (baseada neste projeto) para NestJS

Este documento descreve a arquitetura DDD adotada neste projeto e como aplicá-la em um novo projeto com NestJS. Ele consolida as regras e camadas já praticadas aqui, mantendo o mesmo estilo de organização e separação de responsabilidades.

## Objetivo

Criar uma base consistente para projetos NestJS seguindo DDD + Clean Architecture:

- Regras de negócio isoladas de frameworks e infraestrutura
- Baixo acoplamento entre camadas
- Alto foco em testabilidade e manutenibilidade

## Princípios e regras gerais

- O domínio não depende de nenhuma tecnologia externa
- Todas as dependências apontam sempre para dentro (domain)
- Implementações ficam fora do domínio (data, infrastructure)
- Controllers e middlewares não implementam regra de negócio
- Configuração e composição ficam na camada mais externa (main)
- Padrões de nomenclatura e tipagem são obrigatórios

## Camadas e responsabilidades (como no projeto atual)

### 1) `domain` (núcleo)

**Responsável por contratos e modelos de negócio.**

- Modelos (entidades e retornos)
- DTOs de entrada de use cases
- Interfaces de casos de uso
- Constantes, filtros e mocks de teste

**Não contém implementação de regra de negócio.**

### 2) `data` (implementações)

**Implementa os contratos definidos em `domain`.**

- Use cases concretos
- Repositórios e interfaces específicas
- Integrações orientadas por contrato

### 3) `protocols` (interfaces externas)

**Define contratos para integrações e serviços externos.**

- Cache, storage, email, repositórios genéricos, etc.

### 4) `infrastructure` (adapters)

**Implementa os contratos de `protocols`.**

- ORM, Redis, HTTP, Storage, etc.
- Isolamento total de bibliotecas externas

### 5) `presentation` (interface HTTP)

**Recebe requisições e delega para use cases.**

- Controllers
- Middlewares
- Requests (DTOs de entrada HTTP)
- Helpers de resposta

### 6) `main` (composição)

**Faz a costura entre todas as camadas.**

- Factories de use cases, controllers e middlewares
- Configuração de ambiente
- Setup de serviços

## Mapeamento para NestJS

No NestJS, cada camada vira um conjunto claro de módulos e providers.

### Organização sugerida

```
src/
├── domain/
│   ├── models/
│   ├── dtos/
│   ├── use-cases/
│   ├── filters/
│   ├── constants/
│   └── mocks/
├── data/
│   ├── [módulos]/
│   │   ├── use-cases/
│   │   ├── repositories/
│   │   ├── remote/
│   │   └── cache/
│   └── common/
├── protocols/
│   ├── repositories/
│   ├── cache/
│   ├── mail/
│   └── storage/
├── infrastructure/
│   ├── database/
│   ├── cache/
│   ├── mail/
│   ├── http/
│   └── storage/
├── presentation/
│   ├── [módulos]/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── requests/
│   │   └── mocks/
│   └── common/
└── main/
    ├── application/
    ├── factories/
    └── index.ts
```

### Como aplicar com NestJS

- **Modules (`@Module`)** ficam na camada `main`
- **Controllers (`@Controller`)** ficam em `presentation`
- **Use cases** ficam em `data`, implementando contratos em `domain`
- **Providers externos** ficam em `infrastructure`
- **Interfaces de integrações** ficam em `protocols`

## Fluxo de dependências

```
domain ← data ← presentation ← infrastructure ← main
protocols ← data
protocols ← infrastructure
```

**Importante:** `domain` não depende de nada; `main` pode depender de tudo.

## Convenções de nomenclatura (obrigatórias)

- `*.model.ts` (modelos)
- `*.dto.ts` (DTOs de domínio)
- `*.use-case.ts` (interfaces e implementações)
- `*.filter.ts` (filtros)
- `*.constants.ts` (constantes)
- `*.controller.ts` (controllers)
- `*.middleware.ts` (middlewares)
- `*.spec.ts` (testes)

**Propriedades em `snake_case` e tipos/classes em `PascalCase`.**

## Testes

- Use cases: testes unitários no mesmo diretório do arquivo
- Controllers/middlewares: testes de integração e unitários
- Mocks replicam a estrutura da camada de produção

## Checklists rápidos

### Ao criar um novo módulo

- Criar contratos no `domain`
- Implementar use case em `data`
- Definir interfaces externas em `protocols` (se necessário)
- Implementar adapters em `infrastructure`
- Criar controllers/middlewares em `presentation`
- Compor tudo em `main/factories`

### Ao expor uma nova rota

- Request DTO em `presentation`
- Controller que chama use case
- Use case em `data` com contrato no `domain`
- Repositório/interface no `data` ou `protocols`
- Adapter em `infrastructure`
- Factory em `main`

## Observação final

Esta arquitetura é agnóstica de framework. O NestJS apenas fornece um mecanismo elegante para composição e injeção de dependências, que deve ser concentrado na camada `main`, mantendo o domínio sempre puro e independente.
