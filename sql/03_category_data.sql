-- ============================================================
-- 카테고리 데이터
-- ============================================================
USE [apart];
GO

-- 대분류
INSERT INTO apt_category (cat_code, cat_name, parent_cat_id, sort_order) VALUES
('STRUCT',    '건축기본',   NULL, 1),
('REQUIRED',  '필수물품',   NULL, 2),
('GENERAL',   '일반가정용', NULL, 3);
GO

-- 건축기본 하위
INSERT INTO apt_category (cat_code, cat_name, parent_cat_id, sort_order)
SELECT code, name, cat_id, sort
FROM (VALUES
    ('ST_WINDOW',  '창호/문',     1),
    ('ST_FLOOR',   '바닥재',      2),
    ('ST_WALL',    '벽지/타일',   3),
    ('ST_LIGHT',   '조명기구',    4),
    ('ST_HVAC',    '냉난방/환기', 5),
    ('ST_PLUMB',   '배관/위생',   6),
    ('ST_ELEC',    '전기/통신',   7),
    ('ST_KITCHEN', '빌트인주방',  8),
    ('ST_ETC',     '기타건축',    9)
) AS t(code, name, sort)
CROSS JOIN apt_category c
WHERE c.cat_code = 'STRUCT';
GO

-- 필수물품 하위
INSERT INTO apt_category (cat_code, cat_name, parent_cat_id, sort_order)
SELECT code, name, cat_id, sort
FROM (VALUES
    ('REQ_APPL',   '필수가전',   1),
    ('REQ_BATH',   '욕실필수',   2),
    ('REQ_SAFE',   '안전장치',   3)
) AS t(code, name, sort)
CROSS JOIN apt_category c
WHERE c.cat_code = 'REQUIRED';
GO

-- 일반가정용 하위
INSERT INTO apt_category (cat_code, cat_name, parent_cat_id, sort_order)
SELECT code, name, cat_id, sort
FROM (VALUES
    ('GEN_FURN',   '가구',       1),
    ('GEN_APPL',   '생활가전',   2),
    ('GEN_COOK',   '주방용품',   3),
    ('GEN_BATH',   '욕실용품',   4),
    ('GEN_CLEAN',  '청소/세탁',  5),
    ('GEN_LIGHT',  '조명/인테리어', 6),
    ('GEN_ETC',    '기타생활용품', 7)
) AS t(code, name, sort)
CROSS JOIN apt_category c
WHERE c.cat_code = 'GENERAL';
GO

PRINT '✅ 카테고리 데이터 입력 완료';
GO