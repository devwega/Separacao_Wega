-- ============================================================================
-- Schema SQLite simulando as tabelas Sankhya Om 4.35b647
-- Portal de Troca de Itens
-- Referência: docs/Mapeamento_de_Tabelas_Sankhya_Om_4.35b647.docx
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- TSIUSU — Usuários do sistema
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TSIUSU (
  CODUSU      INTEGER PRIMARY KEY,
  NOMEUSU     TEXT    NOT NULL,
  CODGRUPO    INTEGER,              -- 1=Operacional, 2=Comercial, 3=Supervisor, 4=Gerente
  PERFIL      TEXT                  -- SEPARADOR | COMERCIAL | SUPERVISOR | GERENTE
);

-- ---------------------------------------------------------------------------
-- TGFGRU — Grupos de produtos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFGRU (
  CODGRUPOPROD    INTEGER PRIMARY KEY,
  DESCRGRUPOPROD  TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- TGFPRO — Cadastro de produtos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFPRO (
  CODPROD          INTEGER PRIMARY KEY,
  DESCRPROD        TEXT    NOT NULL,
  REFERENCIA       TEXT,             -- EAN principal
  MARCA            TEXT,
  CODGRUPOPROD     INTEGER REFERENCES TGFGRU(CODGRUPOPROD),
  CODVOL           TEXT,             -- Unidade de medida (UN, CX, KG)
  PRAZOVAL         INTEGER,          -- Shelf life em dias
  LOCALIZACAO      TEXT,             -- Endereço padrão
  ALERTAESTMIN     REAL,             -- Estoque mínimo
  CONTROLELOTE     INTEGER DEFAULT 0 -- 0/1 — produto controlado por lote
);

-- ---------------------------------------------------------------------------
-- TGFBAR — Códigos de barras alternativos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFBAR (
  CODBARRAS        TEXT PRIMARY KEY,
  CODPROD          INTEGER NOT NULL REFERENCES TGFPRO(CODPROD),
  QTDEMBALAGEM     REAL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- TGFLOC — Locais de estoque
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFLOC (
  CODLOCAL     INTEGER PRIMARY KEY,
  DESCRLOCAL   TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- TGFEST — Saldo de estoque por local/lote
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFEST (
  CODPROD     INTEGER NOT NULL REFERENCES TGFPRO(CODPROD),
  CODLOCAL    INTEGER NOT NULL REFERENCES TGFLOC(CODLOCAL),
  CONTROLE    TEXT    NOT NULL DEFAULT '',  -- Número do lote
  ESTOQUE     REAL    NOT NULL DEFAULT 0,
  RESERVADO   REAL    NOT NULL DEFAULT 0,
  DTVAL       TEXT,                          -- Data de validade do lote
  DTFAB       TEXT,                          -- Data de fabricação
  PRIMARY KEY (CODPROD, CODLOCAL, CONTROLE)
);

-- ---------------------------------------------------------------------------
-- TGFPAR — Parceiros (clientes/fornecedores/transportadoras)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFPAR (
  CODPARC     INTEGER PRIMARY KEY,
  NOMEPARC    TEXT NOT NULL,
  TIPO        TEXT             -- CLIENTE | TRANSPORTADORA | FORNECEDOR
);

-- ---------------------------------------------------------------------------
-- TGFVEN — Cadastro de vendedores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFVEN (
  CODVEND     INTEGER PRIMARY KEY,
  APELIDO     TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- TGFTOP — Tipo de Operação
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFTOP (
  CODTIPOPER  INTEGER PRIMARY KEY,
  DHALTER     TEXT,
  DESCROPER   TEXT,
  TIPMOV      TEXT             -- V=Venda, C=Compra
);

-- ---------------------------------------------------------------------------
-- TGFORD — Ordens de carga
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFORD (
  ORDEMCARGA      TEXT PRIMARY KEY,
  DTPREVSAIDA     TEXT,            -- ISO datetime
  CODPARCTRANSP   INTEGER REFERENCES TGFPAR(CODPARC)
);

-- ---------------------------------------------------------------------------
-- TGFCAB — Cabeçalho de pedidos/notas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFCAB (
  NUNOTA           INTEGER PRIMARY KEY,
  NUNNOTA          TEXT,                -- Número visível
  CODPARC          INTEGER NOT NULL REFERENCES TGFPAR(CODPARC),
  CODVEND          INTEGER REFERENCES TGFVEN(CODVEND),
  CODTIPOPER       INTEGER REFERENCES TGFTOP(CODTIPOPER),
  DHTIPOPER        TEXT,
  DTNEG            TEXT,
  VLRNOTA          REAL DEFAULT 0,
  STATUSNOTA       TEXT DEFAULT 'L',    -- P=Pendente, L=Liberado, F=Faturado, B=Bloqueado
  STATUSNFE        TEXT,                -- A=Autorizada, P=Pendente
  ORDEMCARGA       TEXT REFERENCES TGFORD(ORDEMCARGA),
  DTFATUR          TEXT,
  -- Campos customizados sugeridos
  AD_PRIORIDADE    TEXT DEFAULT 'MEDIA',-- ALTA | MEDIA | BAIXA | CRITICA
  AD_STATUSSEP     TEXT DEFAULT 'NAO_INICIADO',
  AD_DTINICIOSEP   TEXT,
  AD_DTFIMSEP      TEXT,
  AD_CODUSUSEP     INTEGER REFERENCES TSIUSU(CODUSU),
  AD_PERCPROGRESSO REAL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- TGFITE — Itens do pedido/nota
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TGFITE (
  NUNOTA          INTEGER NOT NULL REFERENCES TGFCAB(NUNOTA),
  SEQUENCIA       INTEGER NOT NULL,
  CODPROD         INTEGER NOT NULL REFERENCES TGFPRO(CODPROD),
  CODVOL          TEXT,
  QTDNEG          REAL NOT NULL DEFAULT 0,
  QTDENTREGUE     REAL NOT NULL DEFAULT 0,
  QTDCONFERIDA    REAL NOT NULL DEFAULT 0,
  VLRUNIT         REAL DEFAULT 0,
  VLRTOT          REAL DEFAULT 0,
  CONTROLE        TEXT,                -- Lote
  STATUSLOTE      TEXT DEFAULT 'A',    -- A=Aguardando, P=Aprovado, Q=Quarentena, R=Reprovado
  PENDENTE        TEXT DEFAULT 'S',    -- S/N
  RESERVA         TEXT DEFAULT 'N',    -- S/N
  GTINNFE         TEXT,
  PRIMARY KEY (NUNOTA, SEQUENCIA)
);

-- ---------------------------------------------------------------------------
-- AD_SEPARACAO — Controle de separação por pedido
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_SEPARACAO (
  NUSEPARACAO     INTEGER PRIMARY KEY AUTOINCREMENT,
  NUNOTA          INTEGER NOT NULL UNIQUE REFERENCES TGFCAB(NUNOTA),
  STATUS          TEXT DEFAULT 'NAO_INICIADO', -- NAO_INICIADO|EM_ANDAMENTO|CONCLUIDO|DIVERGENCIA
  PERCPROGRESSO   REAL DEFAULT 0,
  CODUSU          INTEGER REFERENCES TSIUSU(CODUSU),
  DTINICIO        TEXT,
  DTFIM           TEXT
);

-- ---------------------------------------------------------------------------
-- AD_TROCAITEM — Registro de trocas/divergências
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_TROCAITEM (
  NUTROCAITEM    INTEGER PRIMARY KEY AUTOINCREMENT,
  NUNOTA         INTEGER NOT NULL REFERENCES TGFCAB(NUNOTA),
  SEQUENCIA      INTEGER NOT NULL,
  CODPRODORIG    INTEGER NOT NULL REFERENCES TGFPRO(CODPROD),
  CODPRODSUBST   INTEGER NOT NULL REFERENCES TGFPRO(CODPROD),
  QTDORIG        REAL NOT NULL,
  QTDSUBST       REAL NOT NULL,
  TIPEQUIV       TEXT,                 -- EXATA | PROPORCIONAL | FUNCIONAL
  FATORCONV      REAL DEFAULT 1,
  MOTIVO         TEXT,
  STATUS         TEXT DEFAULT 'PENDENTE', -- PENDENTE|APROVADO|REJEITADO|BLOQUEADO
  HOMOLOGADA     INTEGER DEFAULT 0,    -- 0/1
  NECESSIDADECLI TEXT,                 -- Nenhuma | Informar | Aprovação obrigatória
  TIPODIVERG     TEXT,                 -- Marca homologada, Proporção/Porcionamento, etc.
  CODUSUAPROV    INTEGER REFERENCES TSIUSU(CODUSU),
  DTAPROV        TEXT,
  DTCRIACAO      TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ---------------------------------------------------------------------------
-- AD_FALTAITEM — Registro de faltas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_FALTAITEM (
  NUFALTAITEM    INTEGER PRIMARY KEY AUTOINCREMENT,
  NUNOTA         INTEGER NOT NULL REFERENCES TGFCAB(NUNOTA),
  SEQUENCIA      INTEGER NOT NULL,
  CODPROD        INTEGER NOT NULL REFERENCES TGFPRO(CODPROD),
  QTDFALTA       REAL NOT NULL,
  TIPO           TEXT DEFAULT 'total', -- total | parcial
  CRITICIDADE    TEXT DEFAULT 'MEDIA', -- CRITICA|ALTA|MEDIA|BAIXA
  ACAO           TEXT,                 -- COMPRA_PADRAO | APANHO | CORTE | NULL
  PRAZORETORNO   TEXT,
  STATUS         TEXT DEFAULT 'PENDENTE', -- PENDENTE|EM_TRATAMENTO|RESOLVIDO
  DTLIMITE       TEXT,
  CODUSU         INTEGER REFERENCES TSIUSU(CODUSU),
  DTCRIACAO      TEXT DEFAULT (datetime('now', 'localtime')),
  DTRESOLUCAO    TEXT,
  OBSERVACAO     TEXT
);

-- ---------------------------------------------------------------------------
-- AD_FLUXODISTINTO — Aprovação gerencial de fluxo distinto
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_FLUXODISTINTO (
  NUFLUXODIST    INTEGER PRIMARY KEY AUTOINCREMENT,
  NUNOTA         INTEGER NOT NULL REFERENCES TGFCAB(NUNOTA),
  SEQUENCIA      INTEGER,
  CODPRODNF      INTEGER NOT NULL REFERENCES TGFPRO(CODPROD),
  CODPRODFISICO  INTEGER NOT NULL REFERENCES TGFPRO(CODPROD),
  TIPO           TEXT,                 -- MARCA_DIFERENTE | GRAMATURA | EMBALAGEM
  JUSTIFICATIVA  TEXT NOT NULL,
  IMPACTO        TEXT,
  STATUS         TEXT DEFAULT 'PENDENTE', -- PENDENTE | APROVADO | REJEITADO
  CODUSUSOLICIT  INTEGER NOT NULL REFERENCES TSIUSU(CODUSU),
  CODUSUAPROV    INTEGER REFERENCES TSIUSU(CODUSU),
  DTSOLICIT      TEXT DEFAULT (datetime('now', 'localtime')),
  DTAPROV        TEXT,
  OBSERVACAO     TEXT
);

-- ---------------------------------------------------------------------------
-- AD_FLUXOHIST — Histórico de eventos do fluxo distinto (relacionado)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_FLUXOHIST (
  NUHIST        INTEGER PRIMARY KEY AUTOINCREMENT,
  NUFLUXODIST   INTEGER NOT NULL REFERENCES AD_FLUXODISTINTO(NUFLUXODIST),
  DATA          TEXT NOT NULL,
  ACAO          TEXT NOT NULL,
  CODUSU        INTEGER REFERENCES TSIUSU(CODUSU)
);

-- ---------------------------------------------------------------------------
-- AD_LOGIN — credenciais de acesso do BIPE (NAO replicado ao Sankhya). US-01..03
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_LOGIN (
  CODUSU     INTEGER PRIMARY KEY REFERENCES TSIUSU(CODUSU),
  LOGIN      TEXT NOT NULL UNIQUE,
  SENHA      TEXT NOT NULL,        -- scrypt: salt:hash
  ATIVO      INTEGER DEFAULT 1,
  DTCRIACAO  TEXT
);

-- ---------------------------------------------------------------------------
-- AD_PARAM — parametros gerais do BIPE (ex.: validade minima global). CV-05
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_PARAM (
  CHAVE       TEXT PRIMARY KEY,
  VALOR       TEXT,
  DTALTERACAO TEXT,
  CODUSU      INTEGER REFERENCES TSIUSU(CODUSU)
);

-- ---------------------------------------------------------------------------
-- AD_VALIDADEMIN — validade minima (dias) por parceiro. Secao 4 (CV-01..05).
-- Especifico do BIPE, NAO replicado ao Sankhya (CV-02).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_VALIDADEMIN (
  CODPARC     INTEGER PRIMARY KEY REFERENCES TGFPAR(CODPARC),
  DIASMIN     INTEGER NOT NULL,
  DTALTERACAO TEXT,
  CODUSU      INTEGER REFERENCES TSIUSU(CODUSU)
);

CREATE TABLE IF NOT EXISTS AD_VALIDADEMIN_HIST (
  NUHIST      INTEGER PRIMARY KEY AUTOINCREMENT,
  CODPARC     INTEGER NOT NULL,
  DIASMIN     INTEGER NOT NULL,
  DTALTERACAO TEXT,
  CODUSU      INTEGER
);

-- ---------------------------------------------------------------------------
-- AD_APANHO_REG — registros de apanho (Secao 9-11). Itens em falta com ACAO='APANHO'.
-- Cada registro = qtd/lote/validade encontrados em campo; conferido na base.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_APANHO_REG (
  NUREG        INTEGER PRIMARY KEY AUTOINCREMENT,
  NUFALTAITEM  INTEGER NOT NULL REFERENCES AD_FALTAITEM(NUFALTAITEM),
  QTD          REAL NOT NULL,
  LOTE         TEXT,
  VALIDADE     TEXT,
  DTREG        TEXT,
  CODUSU       INTEGER,
  CONFERIDO    INTEGER DEFAULT 0,
  DTCONF       TEXT,
  CODUSUCONF   INTEGER,
  LAT          REAL,
  LNG          REAL,
  NFCHAVE      TEXT,
  NFFOTO       TEXT
);

-- ---------------------------------------------------------------------------
-- AD_ITEMLOTE — múltiplos lotes/validade por item do pedido (BS-2.6 / apanho 6.4/7.4)
-- Permite informar mais de um lote/validade para o mesmo item, somando as quantidades.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AD_ITEMLOTE (
  NUITEMLOTE  INTEGER PRIMARY KEY AUTOINCREMENT,
  NUNOTA      INTEGER NOT NULL,
  SEQUENCIA   INTEGER NOT NULL,
  CODEMBARC   TEXT,                 -- embarcação/destino (apanho); NULL no bipe comum
  LOTE        TEXT,
  VALIDADE    TEXT,
  QTD         REAL NOT NULL DEFAULT 0,
  DTREG       TEXT DEFAULT (datetime('now','localtime'))
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_itemlote ON AD_ITEMLOTE(NUNOTA, SEQUENCIA);
CREATE INDEX IF NOT EXISTS idx_tgfite_nunota ON TGFITE(NUNOTA);
CREATE INDEX IF NOT EXISTS idx_tgfest_codprod ON TGFEST(CODPROD);
CREATE INDEX IF NOT EXISTS idx_tgfcab_status ON TGFCAB(STATUSNOTA);
CREATE INDEX IF NOT EXISTS idx_trocaitem_nunota ON AD_TROCAITEM(NUNOTA);
CREATE INDEX IF NOT EXISTS idx_faltaitem_nunota ON AD_FALTAITEM(NUNOTA);
CREATE INDEX IF NOT EXISTS idx_fluxo_nunota ON AD_FLUXODISTINTO(NUNOTA);
