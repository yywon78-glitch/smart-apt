-- ============================================================
-- BOM 구조 데이터 (구역별 물품 배치)
-- ============================================================
USE [apart];
GO

-- ── 거실 (LV) ────────────────────────────────────────────────
INSERT INTO apt_bom (parent_item_id, child_item_id, zone_id, qty, is_required, level_no, sort_order)
SELECT NULL, i.item_id, z.zone_id, 1, req, 0, seq
FROM (VALUES
  ('ST-003', 'Y', 1),   -- 거실창호
  ('ST-010', 'Y', 2),   -- 거실바닥재 (M2 단위이므로 별도 수량 조정)
  ('ST-030', 'Y', 3),   -- 거실조명
  ('ST-040', 'Y', 4),   -- 시스템에어컨
  ('RQ-020', 'Y', 5),   -- 화재감지기
  ('GN-A001', 'N', 6),  -- TV
  ('GN-F001', 'N', 7),  -- 소파
  ('GN-F002', 'N', 8),  -- 거실장
  ('GN-F003', 'N', 9),  -- TV장
  ('GN-A002', 'N', 10), -- 공기청정기
  ('GN-E001', 'N', 11)  -- 커튼
) AS t(code, req, seq)
JOIN apt_item i ON i.item_code = t.code
CROSS JOIN apt_zone z WHERE z.zone_code = 'LV';
GO

-- ── 주방 (KT) ────────────────────────────────────────────────
INSERT INTO apt_bom (parent_item_id, child_item_id, zone_id, qty, is_required, level_no, sort_order)
SELECT NULL, i.item_id, z.zone_id, qty, req, 0, seq
FROM (VALUES
  ('ST-070', 1, 'Y', 1),   -- 싱크대
  ('ST-071', 1, 'Y', 2),   -- 빌트인후드
  ('ST-072', 1, 'Y', 3),   -- 가스쿡탑
  ('RQ-001', 1, 'Y', 4),   -- 냉장고
  ('RQ-005', 1, 'Y', 5),   -- 전자레인지
  ('GN-K001', 1, 'N', 6),  -- 밥솥
  ('GN-K002', 1, 'N', 7),  -- 냄비세트
  ('GN-K003', 1, 'N', 8),  -- 프라이팬세트
  ('GN-K004', 1, 'N', 9),  -- 식기세트
  ('GN-K005', 1, 'N', 10), -- 커피메이커
  ('GN-F004', 1, 'N', 11), -- 식탁
  ('GN-F005', 4, 'N', 12)  -- 식탁의자 4개
) AS t(code, qty, req, seq)
JOIN apt_item i ON i.item_code = t.code
CROSS JOIN apt_zone z WHERE z.zone_code = 'KT';
GO

-- ── 침실1 (BR1) ──────────────────────────────────────────────
INSERT INTO apt_bom (parent_item_id, child_item_id, zone_id, qty, is_required, level_no, sort_order)
SELECT NULL, i.item_id, z.zone_id, qty, req, 0, seq
FROM (VALUES
  ('ST-031', 1, 'Y', 1),   -- 침실조명
  ('ST-004', 1, 'Y', 2),   -- 침실창호
  ('GN-F006', 1, 'N', 3),  -- 침대프레임
  ('GN-F007', 1, 'N', 4),  -- 매트리스
  ('GN-F008', 1, 'N', 5),  -- 옷장
  ('GN-F009', 1, 'N', 6),  -- 책상
  ('GN-F010', 1, 'N', 7),  -- 의자
  ('GN-A006', 1, 'N', 8),  -- 컴퓨터
  ('GN-E001', 1, 'N', 9),  -- 커튼
  ('RQ-020', 1, 'Y', 10)   -- 화재감지기
) AS t(code, qty, req, seq)
JOIN apt_item i ON i.item_code = t.code
CROSS JOIN apt_zone z WHERE z.zone_code = 'BR1';
GO

-- ── 욕실1 (BT1) ──────────────────────────────────────────────
INSERT INTO apt_bom (parent_item_id, child_item_id, zone_id, qty, is_required, level_no, sort_order)
SELECT NULL, i.item_id, z.zone_id, qty, req, 0, seq
FROM (VALUES
  ('ST-050', 1, 'Y', 1),   -- 세면대
  ('ST-051', 1, 'Y', 2),   -- 욕조
  ('ST-053', 1, 'Y', 3),   -- 양변기
  ('ST-054', 1, 'Y', 4),   -- 수전
  ('ST-032', 1, 'Y', 5),   -- 욕실조명
  ('RQ-010', 1, 'Y', 6),   -- 샤워헤드
  ('RQ-011', 1, 'Y', 7),   -- 화장지홀더
  ('RQ-012', 1, 'Y', 8),   -- 수건걸이
  ('GN-B001', 1, 'N', 9),  -- 거울
  ('GN-B002', 1, 'N', 10), -- 수납장
  ('GN-B003', 1, 'N', 11)  -- 목욕세트
) AS t(code, qty, req, seq)
JOIN apt_item i ON i.item_code = t.code
CROSS JOIN apt_zone z WHERE z.zone_code = 'BT1';
GO

-- ── 현관 (EN) ────────────────────────────────────────────────
INSERT INTO apt_bom (parent_item_id, child_item_id, zone_id, qty, is_required, level_no, sort_order)
SELECT NULL, i.item_id, z.zone_id, qty, req, 0, seq
FROM (VALUES
  ('ST-001', 1, 'Y', 1),   -- 현관문
  ('GN-F011', 1, 'N', 2)   -- 신발장
) AS t(code, qty, req, seq)
JOIN apt_item i ON i.item_code = t.code
CROSS JOIN apt_zone z WHERE z.zone_code = 'EN';
GO

-- ── 다용도실 (UT) ────────────────────────────────────────────
INSERT INTO apt_bom (parent_item_id, child_item_id, zone_id, qty, is_required, level_no, sort_order)
SELECT NULL, i.item_id, z.zone_id, qty, req, 0, seq
FROM (VALUES
  ('RQ-002', 1, 'Y', 1),   -- 세탁기
  ('RQ-003', 1, 'N', 2),   -- 건조기
  ('GN-C001', 1, 'N', 3),  -- 빨래건조대
  ('GN-C002', 1, 'N', 4),  -- 청소도구
  ('GN-C003', 1, 'N', 5)   -- 쓰레기통
) AS t(code, qty, req, seq)
JOIN apt_item i ON i.item_code = t.code
CROSS JOIN apt_zone z WHERE z.zone_code = 'UT';
GO

PRINT '✅ BOM 구조 데이터 입력 완료';
GO

-- ============================================================
-- 확인 쿼리 — 구역별 BOM 전개
-- ============================================================
SELECT
    z.zone_name      AS 구역,
    c.cat_name        AS 카테고리,
    i.item_code       AS 물품코드,
    i.item_name       AS 물품명,
    b.qty             AS 수량,
    i.unit            AS 단위,
    FORMAT(i.std_price, 'N0') AS 단가,
    b.is_required     AS 필수여부
FROM apt_bom b
JOIN apt_item    i ON i.item_id = b.child_item_id
JOIN apt_zone    z ON z.zone_id = b.zone_id
JOIN apt_category c ON c.cat_id = i.cat_id
WHERE b.parent_item_id IS NULL
ORDER BY z.sort_order, b.sort_order;
GO