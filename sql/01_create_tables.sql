-- ============================================================
-- 아파트 BOM DB — 테이블 생성
-- DB: apart (gin_db 서버 내)
-- 실행: sqlcmd -S localhost -U sa -P yyw -d apart -i 01_create_tables.sql
-- ============================================================

USE [apart];
GO

-- ── 구역 마스터 ──────────────────────────────────────────────
CREATE TABLE apt_zone (
    zone_id     INT           NOT NULL IDENTITY(1,1),
    zone_code   NCHAR(4)      NOT NULL,          -- LV, KT, BR1, BT1 ...
    zone_name   NVARCHAR(50)  NOT NULL,          -- 거실, 주방, 침실1 ...
    sort_order  INT           NOT NULL DEFAULT 0,
    CONSTRAINT PK_apt_zone PRIMARY KEY (zone_id),
    CONSTRAINT UQ_apt_zone_code UNIQUE (zone_code)
);
GO

-- ── 카테고리 (셀프참조) ───────────────────────────────────────
CREATE TABLE apt_category (
    cat_id        INT           NOT NULL IDENTITY(1,1),
    cat_code      NVARCHAR(10)  NOT NULL,         -- STRUCT, REQ_APPL, FURN ...
    cat_name      NVARCHAR(50)  NOT NULL,         -- 건축기본, 필수가전, 가구 ...
    parent_cat_id INT           NULL,
    sort_order    INT           NOT NULL DEFAULT 0,
    CONSTRAINT PK_apt_category PRIMARY KEY (cat_id),
    CONSTRAINT UQ_apt_category_code UNIQUE (cat_code),
    CONSTRAINT FK_cat_parent FOREIGN KEY (parent_cat_id)
        REFERENCES apt_category(cat_id)
);
GO

-- ── 물품 마스터 ──────────────────────────────────────────────
CREATE TABLE apt_item (
    item_id    INT            NOT NULL IDENTITY(1,1),
    item_code  NVARCHAR(20)   NOT NULL,           -- APT-KT-001 등
    item_name  NVARCHAR(100)  NOT NULL,
    cat_id     INT            NOT NULL,
    unit       NVARCHAR(10)   NOT NULL DEFAULT 'EA',
    std_price  DECIMAL(12,0)  NULL DEFAULT 0,     -- 기준단가 (원)
    brand      NVARCHAR(50)   NULL,
    model      NVARCHAR(100)  NULL,
    spec       NVARCHAR(200)  NULL,               -- 규격 (예: 600L, 55인치)
    note       NVARCHAR(500)  NULL,
    use_yn     CHAR(1)        NOT NULL DEFAULT 'Y',
    CONSTRAINT PK_apt_item PRIMARY KEY (item_id),
    CONSTRAINT UQ_apt_item_code UNIQUE (item_code),
    CONSTRAINT FK_item_cat FOREIGN KEY (cat_id)
        REFERENCES apt_category(cat_id)
);
GO

-- ── BOM 구조 ────────────────────────────────────────────────
CREATE TABLE apt_bom (
    bom_id         INT            NOT NULL IDENTITY(1,1),
    parent_item_id INT            NULL,            -- NULL = 최상위(구역 직속)
    child_item_id  INT            NOT NULL,
    zone_id        INT            NOT NULL,        -- 설치 구역
    qty            DECIMAL(10,2)  NOT NULL DEFAULT 1,
    is_required    CHAR(1)        NOT NULL DEFAULT 'N',  -- Y=필수, N=선택
    level_no       INT            NOT NULL DEFAULT 0,
    sort_order     INT            NOT NULL DEFAULT 0,
    note           NVARCHAR(200)  NULL,
    CONSTRAINT PK_apt_bom PRIMARY KEY (bom_id),
    CONSTRAINT FK_bom_parent FOREIGN KEY (parent_item_id)
        REFERENCES apt_item(item_id),
    CONSTRAINT FK_bom_child FOREIGN KEY (child_item_id)
        REFERENCES apt_item(item_id),
    CONSTRAINT FK_bom_zone FOREIGN KEY (zone_id)
        REFERENCES apt_zone(zone_id)
);
GO

-- ── 아파트 기본정보 (확장용) ─────────────────────────────────
CREATE TABLE apt_apt (
    apt_id      INT            NOT NULL IDENTITY(1,1),
    apt_name    NVARCHAR(100)  NOT NULL,
    apt_type    NVARCHAR(20)   NULL,              -- 33평, 42평 등
    dong        NVARCHAR(10)   NULL,
    ho          NVARCHAR(10)   NULL,
    area_m2     DECIMAL(6,2)   NULL,
    built_year  INT            NULL,
    note        NVARCHAR(500)  NULL,
    CONSTRAINT PK_apt_apt PRIMARY KEY (apt_id)
);
GO

PRINT '✅ 테이블 생성 완료 (5개)';
GO