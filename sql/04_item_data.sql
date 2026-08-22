-- ============================================================
-- 물품 마스터 초기 데이터
-- ============================================================
USE [apart];
GO

-- ── 건축기본 ─────────────────────────────────────────────────
INSERT INTO apt_item (item_code, item_name, cat_id, unit, std_price, spec)
SELECT code, name, c.cat_id, unit, price, spec
FROM (VALUES
  ('ST-001', '현관문',           'ST_WINDOW', 'EA',  1500000, '스틸도어 900×2100'),
  ('ST-002', '방문',             'ST_WINDOW', 'EA',   350000, '목재도어 800×2100'),
  ('ST-003', '거실창호',         'ST_WINDOW', 'SET', 2000000, '이중창 PVC'),
  ('ST-004', '침실창호',         'ST_WINDOW', 'EA',   800000, '이중창 PVC'),
  ('ST-010', '거실바닥재',       'ST_FLOOR',  'M2',   100000, '원목마루 15T'),
  ('ST-011', '침실바닥재',       'ST_FLOOR',  'M2',    80000, '강화마루 8T'),
  ('ST-012', '주방·욕실타일',   'ST_FLOOR',  'M2',    60000, '300×600 도자기타일'),
  ('ST-020', '거실벽지',         'ST_WALL',   'M2',    15000, '합지벽지'),
  ('ST-021', '침실벽지',         'ST_WALL',   'M2',    15000, '합지벽지'),
  ('ST-022', '욕실타일',         'ST_WALL',   'M2',    50000, '200×400 세라믹'),
  ('ST-030', '거실조명',         'ST_LIGHT',  'EA',   200000, 'LED 60W'),
  ('ST-031', '침실조명',         'ST_LIGHT',  'EA',   100000, 'LED 40W'),
  ('ST-032', '욕실조명',         'ST_LIGHT',  'EA',    50000, 'LED 방습형 20W'),
  ('ST-040', '시스템에어컨',     'ST_HVAC',   'EA', 3000000, '멀티형 18평'),
  ('ST-041', '환기시스템',       'ST_HVAC',   'SET',  800000, '전열교환기'),
  ('ST-050', '욕실세면대',       'ST_PLUMB',  'EA',   300000, '매립세면대 600mm'),
  ('ST-051', '욕조',             'ST_PLUMB',  'EA',   500000, '1500mm 아크릴'),
  ('ST-052', '샤워부스',         'ST_PLUMB',  'EA',   700000, '900×900 강화유리'),
  ('ST-053', '양변기',           'ST_PLUMB',  'EA',   400000, '절수형 4.5L'),
  ('ST-054', '욕실수전',         'ST_PLUMB',  'EA',   150000, '크롬 냉온수'),
  ('ST-060', '전기패널',         'ST_ELEC',   'SET',  500000, '분전반 30회로'),
  ('ST-061', 'CCTV',             'ST_ELEC',   'EA',   200000, '실내 FHD'),
  ('ST-070', '싱크대',           'ST_KITCHEN','SET', 3000000, 'ㄷ자형 2700mm'),
  ('ST-071', '빌트인후드',       'ST_KITCHEN','EA',   600000, '슬림형 900mm'),
  ('ST-072', '빌트인가스쿡탑',  'ST_KITCHEN','EA',   500000, '3구 60cm')
) AS t(code, name, catcode, unit, price, spec)
JOIN apt_category c ON c.cat_code = t.catcode;
GO

-- ── 필수물품 ─────────────────────────────────────────────────
INSERT INTO apt_item (item_code, item_name, cat_id, unit, std_price, spec)
SELECT code, name, c.cat_id, unit, price, spec
FROM (VALUES
  ('RQ-001', '냉장고',           'REQ_APPL', 'EA', 1500000, '양문형 800L'),
  ('RQ-002', '세탁기',           'REQ_APPL', 'EA',  900000, '드럼 15kg'),
  ('RQ-003', '건조기',           'REQ_APPL', 'EA',  800000, '콘덴서 9kg'),
  ('RQ-004', '에어컨(이동식)',   'REQ_APPL', 'EA',  600000, '10평형 스탠드'),
  ('RQ-005', '전자레인지',       'REQ_APPL', 'EA',  200000, '30L 오븐형'),
  ('RQ-010', '샤워헤드',         'REQ_BATH', 'EA',   80000, '3단조절 레인'),
  ('RQ-011', '화장지홀더',       'REQ_BATH', 'EA',   20000, '스테인레스'),
  ('RQ-012', '수건걸이',         'REQ_BATH', 'EA',   30000, '더블 60cm'),
  ('RQ-020', '화재감지기',       'REQ_SAFE', 'EA',   50000, '광전식'),
  ('RQ-021', '가스감지기',       'REQ_SAFE', 'EA',   80000, '도시가스용'),
  ('RQ-022', '소화기',           'REQ_SAFE', 'EA',   50000, '분말 3.3kg')
) AS t(code, name, catcode, unit, price, spec)
JOIN apt_category c ON c.cat_code = t.catcode;
GO

-- ── 일반가정용 ───────────────────────────────────────────────
INSERT INTO apt_item (item_code, item_name, cat_id, unit, std_price, spec)
SELECT code, name, c.cat_id, unit, price, spec
FROM (VALUES
  -- 가구
  ('GN-F001', '소파',           'GEN_FURN', 'EA', 1000000, '3인용 패브릭'),
  ('GN-F002', '거실장',         'GEN_FURN', 'EA',  500000, '1500mm'),
  ('GN-F003', 'TV장',           'GEN_FURN', 'EA',  400000, '1800mm'),
  ('GN-F004', '식탁',           'GEN_FURN', 'EA',  600000, '4인용'),
  ('GN-F005', '식탁의자',       'GEN_FURN', 'EA',  120000, '패브릭'),
  ('GN-F006', '침대프레임',     'GEN_FURN', 'EA',  600000, '퀸사이즈'),
  ('GN-F007', '매트리스',       'GEN_FURN', 'EA',  800000, '퀸 독립스프링'),
  ('GN-F008', '옷장',           'GEN_FURN', 'EA',  800000, '슬라이딩 2400mm'),
  ('GN-F009', '책상',           'GEN_FURN', 'EA',  300000, '1200×600mm'),
  ('GN-F010', '의자(사무)',      'GEN_FURN', 'EA',  250000, '메쉬형'),
  ('GN-F011', '신발장',         'GEN_FURN', 'EA',  400000, '슬림 900mm'),
  -- 생활가전
  ('GN-A001', 'TV',             'GEN_APPL', 'EA', 1200000, '65인치 4K OLED'),
  ('GN-A002', '공기청정기',     'GEN_APPL', 'EA',  400000, '거실용 50평'),
  ('GN-A003', '제습기',         'GEN_APPL', 'EA',  300000, '20L/일'),
  ('GN-A004', '청소기(로봇)',   'GEN_APPL', 'EA',  700000, '라이다 매핑'),
  ('GN-A005', '청소기(스틱)',   'GEN_APPL', 'EA',  300000, '무선 경량'),
  ('GN-A006', '컴퓨터',        'GEN_APPL', 'EA', 1500000, '데스크탑'),
  ('GN-A007', '냉온정수기',     'GEN_APPL', 'EA',  500000, '직수형'),
  -- 주방용품
  ('GN-K001', '밥솥',           'GEN_COOK', 'EA',  300000, '10인용 IH압력'),
  ('GN-K002', '냄비세트',       'GEN_COOK', 'SET', 200000, '3종'),
  ('GN-K003', '프라이팬세트',   'GEN_COOK', 'SET', 150000, '2종 코팅'),
  ('GN-K004', '식기세트',       'GEN_COOK', 'SET', 100000, '4인 기본'),
  ('GN-K005', '커피메이커',     'GEN_COOK', 'EA',  200000, '캡슐형'),
  ('GN-K006', '믹서기',         'GEN_COOK', 'EA',  100000, '1.5L'),
  -- 욕실용품
  ('GN-B001', '거울(욕실)',      'GEN_BATH', 'EA',  150000, '700×900 방습'),
  ('GN-B002', '세면대수납장',   'GEN_BATH', 'EA',  200000, '미러캐비닛'),
  ('GN-B003', '목욕세트',       'GEN_BATH', 'SET',  50000, '타월·바스매트'),
  -- 청소/세탁
  ('GN-C001', '빨래건조대',     'GEN_CLEAN','EA',   80000, '접이식'),
  ('GN-C002', '청소도구세트',   'GEN_CLEAN','SET',  50000, '대걸레·빗자루'),
  ('GN-C003', '쓰레기통세트',   'GEN_CLEAN','SET',  60000, '분리수거 3종'),
  -- 기타
  ('GN-E001', '커튼',           'GEN_LIGHT','SET', 300000, '암막+쉬어'),
  ('GN-E002', '블라인드',       'GEN_LIGHT','EA',  150000, '목재 베네치안'),
  ('GN-E003', '무드등',         'GEN_LIGHT','EA',   50000, 'LED 간접조명')
) AS t(code, name, catcode, unit, price, spec)
JOIN apt_category c ON c.cat_code = t.catcode;
GO

PRINT '✅ 물품 마스터 입력 완료';
GO