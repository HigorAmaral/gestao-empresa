# GestãoPro — Sistema Integrado de Gestão Empresarial (ERP)

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.6-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.19-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-336791?style=flat&logo=postgresql)](https://neon.tech/)
[![PWA](https://img.shields.io/badge/PWA-Ready-10b981?style=flat)](https://web.dev/progressive-web-apps/)

Sistema ERP e CRM corporativo moderno, robusto e responsivo, desenvolvido com **Next.js 16 (App Router + Server Actions)**, **React 19**, **TypeScript**, **Prisma ORM**, **PostgreSQL** e **Lucide Icons**. 

Projetado para pequenas, médias e grandes empresas com foco em alta performance, automação de rotinas, emissão fiscal, conciliação bancária, chão de fábrica (PCP), recursos humanos (RH/SST) e autoatendimento do colaborador com estrita conformidade à LGPD.

---

##  Sumário

1. [Visão Geral dos Módulos](#-visão-geral-dos-módulos)
2. [Principais Recursos & Inovações](#-principais-recursos--inovações)
3. [Tecnologias Utilizadas](#-tecnologias-utilizadas)
4. [Estrutura do Banco de Dados](#-estrutura-do-banco-de-dados)
5. [Como Executar Localmente](#-como-executar-localmente)
6. [Credenciais de Acesso](#-credenciais-de-acesso)
7. [Scripts Disponíveis](#-scripts-disponíveis)
8. [Estrutura de Pastas](#-estrutura-de-pastas)
9. [Segurança e Governança](#-segurança-e-governança)

---

##  Visão Geral dos Módulos

| Módulo | Rota | Descrição e Funcionalidades |
| :--- | :--- | :--- |
| **Dashboard Executivo** | `/` | Indicadores em tempo real (Faturamento, Entradas, Saídas, Saldo de Caixa), gráficos dos últimos 6 meses, ranking de vendas recentes e alertas automáticos de estoque mínimo. |
| **Vendas & PDV** | `/vendas`, `/pdv` | Orçamentos e pedidos de venda com múltiplos itens, descontos, cálculo automático de impostos e baixa de estoque. Inclui **PDV Ágil** e **Recibo Térmico/A4 imprimível** (`/vendas/[id]/recibo`). |
| **Funil de Vendas (CRM)** | `/vendas/funil` | Pipeline visual Kanban (Lead, Contato, Proposta, Negociação, Ganho, Perdido) com filtro inteligente de clientes inativos e reativação em 1 clique via WhatsApp. |
| **Contratos & Recorrência** | `/contratos` | Gestão de contratos e assinaturas periódicas (mensal, trimestral, semestral, anual) com faturamento automatizado de mensalidades e alertas de renovação. |
| **Ordens de Serviço (OS)** | `/os` | Gestão de assistência técnica com laudo pericial, prioridades, peças utilizadas (com baixa automática de estoque), mão de obra, comprovante impresso e **Link Público para o Cliente** com QR Code Pix (`/p/os/[id]`). |
| **Produtos & Serviços** | `/produtos` | Cadastro de produtos e serviços, código de barras/SKU, categorias, controle de margem de lucro, estoque mínimo e gerador de etiquetas (`/produtos/etiquetas`). |
| **Estoque & Armazém** | `/estoque` | Valorização de inventário (custo e venda), movimentações manuais e auditoria de saldos em tempo real. |
| **Endereçamento WMS** | `/estoque/enderecamento` | Localização física no armazém por rua, estante, nível e gaveta, com mapa de ocupação e etiquetas de localização. |
| **Compras & Suprimentos** | `/compras` | Pedidos de compra a fornecedores com previsão de entrega, geração automática de contas a pagar e atualização automática do custo médio. |
| **Recebimento de Mercadorias** | `/recebimento` | Módulo WMS para conferência cega de mercadorias recebidas, registro de divergências e entrada rápida em estoque. |
| **Clientes & Fornecedores** | `/clientes`, `/fornecedores` | Cadastros completos com busca automática de CNPJ (ReceitaWS) e CEP (ViaCEP), limites de crédito e histórico de compras/pedidos. |
| **Financeiro & Fluxo de Caixa** | `/financeiro` | Contas a pagar e receber, baixas parciais/totais, plano de contas, DRE gerencial e controle de sessões de caixa. |
| **Conciliação Bancária OFX** | `/financeiro/conciliacao` | Importação de extratos bancários em formato `.ofx`, correspondência automática com títulos existentes e conciliação em lote com 1 clique. |
| **Nota Fiscal Eletrônica (NF-e)** | `/nfe` | Emissão de NF-e e NFC-e com tributação completa (ICMS, PIS, COFINS, CFOP, NCM), geração de XML e DANFE formatada para impressão. |
| **Produção & Fábrica (PCP)** | `/producao` | Ordens de Produção (OP), receita/ficha técnica de insumos (BOM), controle de perdas e status de máquinas industriais. |
| **Recursos Humanos & Folha** | `/funcionarios` | Cadastro de colaboradores, cargos, departamentos, cálculo de folha com encargos trabalhistas (INSS, IRRF, FGTS) e recibos de pagamento. |
| **Ponto Eletrônico & REP** | `/funcionarios/ponto` | Registro de batidas de ponto, importação de arquivo AFD (Portaria 671 MTE), apuração de horas extras e adicionais noturnos. |
| **SST — Saúde e Segurança** | `/funcionarios/sst` | Ficha de entrega e devolução de EPIs com Certificado de Aprovação (CA), exames ocupacionais (ASO) e treinamentos periódicos. |
| **Portal do Colaborador** | `/portal-colaborador` | Área de autoatendimento exclusiva para o funcionário consultar seus próprios holerites, espelho de ponto, saldo de férias e EPIs com isolamento total (LGPD). |
| **Relatórios & Curva ABC** | `/relatorios` | DRE analítico, lucratividade por categoria, vendas por vendedor e **Curva ABC de Estoque (80/20)** com gráficos interativos. |
| **Auditoria & Segurança** | `/auditoria` | Rastreabilidade total de ações (criação, edição, exclusão, logins) com data, hora, IP e operador responsável. |
| **Configurações & Identidade** | `/configuracoes` | Logotipo da empresa, personalização de cores do sistema (primária, sidebar e destaque), consulta de dados da Receita Federal e manutenção do banco. |

---

##  Principais Recursos & Inovações

- **PIX Dinâmico com QR Code Nativo (EMVCo BR Code):** Geração instantânea de Pix Copia e Cola nos recibos e nas ordens de serviço públicas sem dependência de gateways intermediários.
- **Motor de Automações em Segundo Plano:** Executa cobranças recorrentes de contratos, checa estoques mínimos e programa manutenções automáticas (`/api/automations/run`).
- **PWA (Progressive Web App):** Instalável no celular, tablet ou desktop como aplicativo nativo, com manifesto web e navegação otimizada.
- **Consulta Automática CNPJ & CEP:** Preenchimento instantâneo de dados cadastrais e fiscais da empresa e dos clientes diretamente dos webservices da Receita Federal e ViaCEP.
- **Segurança LGPD no Portal do Colaborador:** Funcionários autenticados acessam exclusivamente suas próprias informações trabalhistas sem possibilidade de visualizar dados de outros colegas.
- **Zona de Manutenção & Limpeza de Dados:** Ferramenta administrativa segura em `/configuracoes` para zerar dados transacionais e de teste em 1 clique mantendo os acessos autorizados.

---

##  Tecnologias Utilizadas

- **Framework Web:** [Next.js 16](https://nextjs.org/) (Turbopack, Server Components & Server Actions)
- **Biblioteca de UI:** [React 19](https://react.dev/) + [Lucide Icons](https://lucide.dev/)
- **Linguagem:** [TypeScript 6](https://www.typescriptlang.org/)
- **Banco de Dados:** [PostgreSQL](https://www.postgresql.org/) (hospedado na nuvem via [Neon Serverless](https://neon.tech/)) e compatível com SQLite local
- **ORM:** [Prisma ORM 6](https://www.prisma.io/) com pool adaptativo de conexões serverless
- **Autenticação & Sessões:** JWT criptografado via [Jose](https://github.com/panva/jose) em cookies `httpOnly`, hash seguro de senhas com [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **Backend Adicional:** [Django 5.2](https://www.djangoproject.com/) + [Django REST Framework](https://www.django-rest-framework.org/) (`django_backend/`)

---

##  Estrutura do Banco de Dados

```mermaid
erDiagram
    CompanySettings ||--o{ User : define
    User ||--o{ Sale : registra
    User ||--o{ Purchase : registra
    User ||--o{ ServiceOrder : atende
    User ||--o{ StockMovement : movimenta
    User ||--o{ AuditLog : rastreia
    User ||--o| Employee : vincula

    Client ||--o{ Sale : realiza
    Client ||--o{ ServiceOrder : solicita
    Client ||--o{ Contract : assina

    Supplier ||--o{ Product : fornece
    Supplier ||--o{ Purchase : recebe

    Product ||--o{ SaleItem : contem
    Product ||--o{ PurchaseItem : contem
    Product ||--o{ ServiceOrderItem : contem
    Product ||--o{ StockMovement : historico
    Product ||--o{ ProductStockLocation : enderecado

    Sale ||--|{ SaleItem : possui
    Sale ||--o{ FinancialEntry : fatura

    Purchase ||--|{ PurchaseItem : possui
    Purchase ||--o{ FinancialEntry : gera_despesa

    ServiceOrder ||--o{ ServiceOrderItem : consome
    ServiceOrder ||--o{ FinancialEntry : fatura

    ProductionOrder ||--o{ ProductionOrderItem : produz
    ProductRecipeItem }o--|| Product : compoe_receita

    Employee ||--o{ EmployeePayrollEvent : folha
    Employee ||--o{ EmployeeLeave : afastamento
    Employee ||--o{ EmployeeSafetyRecord : epi
    Employee ||--o{ TimeClockLog : ponto
```

---

##  Como Executar Localmente

### Pré-requisitos
- **Node.js** 18+ (recomendado LTS)
- **npm** ou **pnpm**
- **Python** 3.10+ (opcional, para executar o backend Django integrado)

### 1. Clonar e Instalar
```bash
git clone https://github.com/HigorAmaral/gestao-empresa.git
cd gestao-empresa
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie seu arquivo `.env` na raiz do projeto:
```bash
cp .env.example .env
```
Exemplo de configuração:
```env
DATABASE_URL="postgresql://usuario:senha@host:5432/banco?sslmode=require"
AUTH_SECRET="chave-secreta-aleatoria-longa-para-jwt-123456789"
```

### 3. Sincronizar o Banco e Iniciar
```bash
# Sincroniza o schema com o banco de dados
npm run db:push

# Inicia o servidor Next.js em modo de desenvolvimento
npm run dev
```

Acesse **http://localhost:3000** no seu navegador.

---

##  Credenciais de Acesso

O sistema dispõe de botões de preenchimento rápido de demonstração na tela de login (`/login`):

| Perfil | E-mail | Senha | Nível de Permissão |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@empresa.com` | `admin123` | Acesso Irrestrito (todos os 22 módulos) |
| **Funcionário** | `func@empresa.com` | `func123` | Operacional (Vendas, OS, Estoque, Clientes, Compras) |

> O administrador proprietário registrado possui login prioritário com permissões globais de governança.

---

##  Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor de desenvolvimento com compilação instantânea Turbopack |
| `npm run build` | Valida TypeScript, gera os clientes Prisma e compila o projeto para produção |
| `npm run start` | Inicializa o servidor compilado em ambiente de produção |
| `npm run db:push` | Aplica alterações do `schema.prisma` diretamente ao banco de dados |
| `npm run db:seed` | Popula o banco com sementes e estruturas iniciais |
| `npm run db:reset` | Recria o banco de dados do zero aplicando o schema mais recente |
| `npm run db:studio` | Abre o painel visual Prisma Studio no navegador |
| `npm run django` | Inicia o servidor auxiliar Django REST na porta 8000 |

---

##  Estrutura de Pastas

```text
gestao-empresa/
├── prisma/
│   ├── schema.prisma              # Modelagem relacional Prisma (33 entidades)
│   └── seed.mjs                   # Rotinas de seed e configuração
├── src/
│   ├── app/
│   │   ├── (app)/                 # Aplicação principal com Sidebar e autenticação
│   │   │   ├── auditoria/         # Trilha de auditoria das operações
│   │   │   ├── clientes/          # Gestão de clientes e histórico comercial
│   │   │   ├── compras/           # Pedidos de compra e cotações
│   │   │   ├── configuracoes/     # Personalização de layout, dados fiscais e reset
│   │   │   ├── contratos/         # Gestão de mensalidades e recorrências
│   │   │   ├── estoque/           # Estoque geral, inventário e WMS
│   │   │   ├── financeiro/        # Contas a pagar/receber, conciliação OFX e fluxo
│   │   │   ├── fornecedores/      # Cadastro de parceiros comerciais
│   │   │   ├── funcionarios/      # RH, cálculo de folha, ponto eletrônico e SST
│   │   │   ├── nfe/               # Módulo fiscal, DANFE e XML
│   │   │   ├── os/                # Ordens de serviço e laudo técnico
│   │   │   ├── pdv/               # Ponto de Venda ágil
│   │   │   ├── portal-colaborador/# Autoatendimento do funcionário (LGPD)
│   │   │   ├── producao/          # PCP, ordens de produção e fichas técnicas
│   │   │   ├── produtos/          # Catálogo de produtos, insumos e serviços
│   │   │   ├── recebimento/       # Conferência de mercadorias no armazém
│   │   │   ├── relatorios/        # DRE, Curva ABC e Business Intelligence
│   │   │   ├── usuarios/          # Gestão de acessos e permissões por módulo
│   │   │   ├── vendas/            # Pedidos, orçamentos e funil Kanban (CRM)
│   │   │   └── page.tsx           # Dashboard principal com métricas
│   │   ├── api/                   # Rotas de API (automações, backup, exportações)
│   │   ├── p/                     # Páginas públicas (comprovantes e links de OS com Pix)
│   │   ├── login/                 # Autenticação segura com preenchimento rápido
│   │   ├── globals.css            # Estilos do sistema, variáveis de tema e impressão
│   │   └── layout.tsx             # Shell da aplicação com suporte a PWA
│   ├── components/                # Componentes reutilizáveis (Gráficos, Modais, Tabelas)
│   ├── lib/                       # Motores de cálculo (Pix, OFX, RH, Automações, Prisma)
│   └── proxy.ts                   # Middleware de proteção de rotas e RBAC
├── django_backend/                # Backend complementar Django & Django Admin
├── public/                        # Ícones PWA, logos e recursos estáticos
├── package.json
└── tsconfig.json
```

---

##  Segurança e Governança

- **RBAC (Controle de Acesso Baseado em Funções):** Separação estrita entre `ADMIN` e `FUNCIONARIO`, com controle granular de permissões por módulo.
- **Trilha de Auditoria Contínua:** Registro inviolável de todas as ações de impacto no sistema com operador, ação e data/hora.
- **Isolamento LGPD:** Endpoints e visões do colaborador blindados para impedir o vazamento ou visualização cruzada de informações pessoais.
- **Tokens Criptografados:** Sessões armazenadas em cookies protegidos com `HttpOnly`, `SameSite=Lax` e criptografia SHA-256.

---

Desenvolvido para máxima produtividade empresarial. 🚀
