# CLAUDE.md — Guia de Contexto do Projeto Enterprise

## Visão Geral

Unificação do sistema web de tarefas (`gestordetarefas`) e do sistema desktop Python/PyQt (`microsasesc`) em um único **Portal Web Enterprise** com Next.js, TypeScript, Tailwind CSS e Supabase/PostgreSQL.

## Stack Tecnológica

- **Frontend:** Next.js (App Router), TypeScript estrito, Tailwind CSS (Mobile-First)
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Deploy:** Vercel (frontend), Supabase (banco e storage)

## Arquitetura de Acessos (Multi-Tenant RBAC)

| Papel | Acesso |
|---|---|
| `admin` / Escritório | Total — todos os módulos e clientes |
| `gestor_cliente` | Empresa própria — documentos, obrigações, guias |
| `colaborador_cliente` | Apenas seu CPF — holerites, informes, férias |

## Regras de Desenvolvimento

### TypeScript
- **Zero `any`** — tipagem estrita em todos os arquivos
- Interfaces e enums em `src/types/database.types.ts`
- Props de componentes sempre tipadas com interfaces nomeadas

### UI / Tailwind
- **Mobile-First** — breakpoints crescentes (`sm:`, `md:`, `lg:`)
- Preparado para **PWA** (manifest, service worker)
- Responsivo para smartphone e desktop

### Segurança
- **Zero-Trust**: nenhuma rota sem autenticação
- **RLS estrito** no Supabase em todas as tabelas
- Buckets de Storage **privados** com Signed URLs (nunca públicos para dados sensíveis)
- Cofre de senhas com criptografia **E2EE** no cliente

### Banco de Dados
- Todas as mudanças de schema via **arquivos de migração SQL** em `/supabase/migrations/`
- Nomenclatura: `YYYYMMDD_descricao_curta.sql`
- Nunca executar DDL direto no SQL Editor sem criar o arquivo de migração correspondente

## Estrutura de Pastas

```
/src
  /app          — Rotas e páginas (App Router)
  /components   — Componentes UI modulares e responsivos
  /lib          — Configurações do Supabase e utilitários
  /services     — Regras de negócio e chamadas de API
  /types        — Tipagens TypeScript estritas
/supabase
  /migrations   — Scripts SQL de migração numerados
```

## Módulos do Sistema

### Do gestordetarefas (legado web)
- Tarefas por setor (Legalização, Fiscal, RH, Office Boy, Gerencial)
- Clientes / Empresas (CNPJ, regime tributário, responsável)
- Obrigações mensais por cliente
- Processos de legalização
- Rotinas recorrentes com alertas
- Parcelamentos fiscais
- Controle gerencial mensal
- Entregas / Office Boy
- Anexos (PDFs e imagens vinculados a entidades)
- Log de acessos por funcionário

### Do microsasesc (legado desktop Python/PyQt)
- Funcionários e departamentos
- Contratos
- Ordens de serviço
- Holerites, informes, férias (acesso por colaborador)

## Convenções de Nomenclatura

- Arquivos de componente: `PascalCase.tsx`
- Arquivos de serviço/lib: `camelCase.ts`
- Tabelas SQL: `snake_case`
- Colunas SQL: `snake_case`
- IDs: sempre `uuid` com `gen_random_uuid()`
