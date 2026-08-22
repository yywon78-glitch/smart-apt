const express = require('express');
const path    = require('path');
const fs      = require('fs');
const sql     = require('mssql');

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
  user:     'sa',
  password: 'yyw',
  server:   'localhost',
  database: 'apart',
  options: { trustServerCertificate: true, enableArithAbort: true, encrypt: false }
};

let pool;
async function getPool() {
  if (!pool) pool = await sql.connect(dbConfig);
  return pool;
}
async function query(sqlStr, params = {}) {
  const p = await getPool();
  const req = p.request();
  Object.entries(params).forEach(([k, v]) => req.input(k, v));
  return (await req.query(sqlStr)).recordset;
}

/* ══════════════════════════════════════════════════════════
   BOM 마이그레이션: zone → apt_item 통합 (한 번만 실행)
══════════════════════════════════════════════════════════ */
app.post('/api/migrate-to-bom', async (_req, res) => {
  try {
    const p = await getPool();

    // 이미 마이그레이션 됐는지 확인 (H 노드 존재 여부로 판단)
    const chk = await query(`SELECT COUNT(*) AS cnt FROM apt_item WHERE node_type='H'`).catch(() => [{cnt:0}]);
    if (chk[0].cnt > 0) return res.json({ ok: true, skipped: true, msg: '이미 완료' });

    // 1. apt_item에 node_type(H/Z/I), sort_order 추가 (없으면)
    const hasCols = await query(`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='apt_item' AND COLUMN_NAME='node_type'`);
    if (hasCols[0].cnt === 0) {
      await p.request().query(`ALTER TABLE apt_item ADD node_type CHAR(1) NOT NULL DEFAULT 'I'`);
      await p.request().query(`ALTER TABLE apt_item ADD sort_order INT NOT NULL DEFAULT 0`);
    }

    // 2. 우리집 노드 삽입
    let houseCode = 'H000001', houseName = '우리집';
    try {
      const h = await query('SELECT TOP 1 house_code, house_name FROM apt_house ORDER BY sort_order');
      if (h[0]) { houseCode = h[0].house_code; houseName = h[0].house_name; }
    } catch (_) {}
    const defCat = (await query(`SELECT TOP 1 cat_id FROM apt_category WHERE parent_cat_id IS NOT NULL ORDER BY sort_order`))[0]?.cat_id || 1;
    const hR = await p.request().query(`
      INSERT INTO apt_item (item_code, item_name, node_type, cat_id, sort_order, use_yn)
      VALUES ('${houseCode}', N'${houseName}', 'H', ${defCat}, 0, 'Y');
      SELECT SCOPE_IDENTITY() AS item_id`);
    const houseId = hR.recordset[0].item_id;

    // 3. 구역 → apt_item 삽입 + house→zone BOM
    const zones = await query('SELECT zone_id, zone_code, zone_name, sort_order FROM apt_zone ORDER BY sort_order');
    const zMap = new Map(); // zone_id → new item_id
    for (const z of zones) {
      const zR = await p.request().query(`
        INSERT INTO apt_item (item_code, item_name, node_type, cat_id, sort_order, use_yn)
        VALUES ('${z.zone_code}', N'${z.zone_name}', 'Z', ${defCat}, ${z.sort_order || 0}, 'Y');
        SELECT SCOPE_IDENTITY() AS item_id`);
      const zId = zR.recordset[0].item_id;
      zMap.set(z.zone_id, zId);
      await p.request().query(`
        INSERT INTO apt_bom (parent_item_id, child_item_id, zone_id, qty, is_required, sort_order, level_no)
        VALUES (${houseId}, ${zId}, ${z.zone_id}, 1, 'N', ${z.sort_order || 0}, 0)`);
    }

    // 4. 기존 최상위 항목(parent=NULL)의 parent_item_id → zone item_id로 연결
    for (const [oldZoneId, newZoneItemId] of zMap) {
      await p.request().query(`
        UPDATE apt_bom SET parent_item_id = ${newZoneItemId}, level_no = level_no + 1
        WHERE zone_id = ${oldZoneId} AND parent_item_id IS NULL
          AND child_item_id NOT IN (SELECT item_id FROM apt_item WHERE node_type IN ('H','Z'))`);
    }

    // 5. apt_bom에서 zone_id FK 제거 후 컬럼 삭제
    await p.request().query(`
      DECLARE @sql NVARCHAR(MAX)=''
      SELECT @sql=@sql+'ALTER TABLE apt_bom DROP CONSTRAINT ['+fk.name+'];'
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fc ON fk.object_id=fc.constraint_object_id
      JOIN sys.columns c ON fc.parent_object_id=c.object_id AND fc.parent_column_id=c.column_id
      WHERE fk.parent_object_id=OBJECT_ID('apt_bom') AND c.name='zone_id'
      IF @sql!='' EXEC sp_executesql @sql`);
    await p.request().query(`ALTER TABLE apt_bom DROP COLUMN zone_id`);

    // 6. apt_fp_zone.zone_id → 새 item_id로 교체 후 apt_zone FK 제거
    for (const [oldZoneId, newZoneItemId] of zMap) {
      try { await p.request().query(`UPDATE apt_fp_zone SET zone_id=${newZoneItemId} WHERE zone_id=${oldZoneId}`); } catch (_) {}
    }
    await p.request().query(`
      DECLARE @sql NVARCHAR(MAX)=''
      SELECT @sql=@sql+'ALTER TABLE apt_fp_zone DROP CONSTRAINT ['+fk.name+'];'
      FROM sys.foreign_keys fk WHERE fk.parent_object_id=OBJECT_ID('apt_fp_zone')
        AND fk.referenced_object_id=OBJECT_ID('apt_zone')
      IF @sql!='' EXEC sp_executesql @sql`);

    // 7. 구 테이블 삭제
    try { await p.request().query(`DROP TABLE apt_zone`); } catch (_) {}
    try { await p.request().query(`DROP TABLE apt_house`); } catch (_) {}

    res.json({ ok: true, houseId, zones: zones.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   BOM 트리 전체 조회 (house 포함 통합 트리)
══════════════════════════════════════════════════════════ */
app.get('/api/bom-tree', async (req, res) => {
  try {
    const { required } = req.query;
    const where = required === 'Y' ? "AND b.is_required='Y'" : '';
    const house = await query(`SELECT TOP 1 item_id, item_code, item_name, node_type FROM apt_item WHERE node_type='H'`);
    const rows  = await query(`
      SELECT b.bom_id, b.parent_item_id,
             i.item_id, i.node_type, i.item_code, i.item_name, i.unit, i.cat_id,
             CAST(i.std_price AS INT) AS std_price, i.brand, i.spec, i.sort_order AS item_sort,
             CAST(b.qty AS INT) AS qty, b.is_required, b.sort_order, b.level_no
      FROM apt_bom b
      JOIN apt_item i ON i.item_id = b.child_item_id
      WHERE 1=1 ${where}
      ORDER BY b.sort_order, b.level_no`);
    const h = house[0];
    const result = h
      ? [{ bom_id: null, parent_item_id: null, item_id: h.item_id, node_type: 'H',
           item_code: h.item_code, item_name: h.item_name, qty: 1, is_required: 'N',
           sort_order: 0, level_no: -1 }, ...rows]
      : rows;
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 구역 목록 (드롭다운용 – apt_item WHERE node_type='Z') */
app.get('/api/zones', async (_req, res) => {
  try {
    const rows = await query(`
      SELECT b.bom_id, i.item_id AS zone_id, i.item_code AS zone_code,
             i.item_name AS zone_name, i.sort_order
      FROM apt_item i
      JOIN apt_bom b ON b.child_item_id = i.item_id
      WHERE i.node_type = 'Z'
      ORDER BY i.sort_order`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 우리집 정보 */
app.get('/api/house', async (_req, res) => {
  try {
    const rows = await query(`SELECT TOP 1 item_id AS house_id, item_code AS house_code, item_name AS house_name FROM apt_item WHERE node_type='H'`);
    res.json(rows[0] || { house_id: null, house_code: 'H000001', house_name: '우리집' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 카테고리 목록 */
app.get('/api/categories', async (_req, res) => {
  try {
    const rows = await query('SELECT cat_id, cat_code, cat_name FROM apt_category WHERE parent_cat_id IS NOT NULL ORDER BY sort_order');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 비용 요약 (구역별) */
app.get('/api/cost', async (_req, res) => {
  try {
    const rows = await query(`
      SELECT zi.item_name AS zone_name,
        SUM(CASE WHEN b.is_required='Y' THEN ii.std_price*b.qty ELSE 0 END) AS req_cost,
        SUM(CASE WHEN b.is_required='N' THEN ii.std_price*b.qty ELSE 0 END) AS opt_cost,
        SUM(ii.std_price*b.qty) AS total_cost
      FROM apt_bom b
      JOIN apt_item ii ON ii.item_id = b.child_item_id AND ii.node_type = 'I'
      JOIN apt_bom  zb ON zb.child_item_id = b.parent_item_id
      JOIN apt_item zi ON zi.item_id = zb.child_item_id AND zi.node_type = 'Z'
      WHERE b.parent_item_id IN (SELECT item_id FROM apt_item WHERE node_type='Z')
      GROUP BY zi.item_id, zi.item_name, zi.sort_order
      ORDER BY zi.sort_order`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   Zone CRUD (apt_item node_type='Z')
══════════════════════════════════════════════════════════ */
app.post('/api/zones', async (req, res) => {
  try {
    const { zone_name, zone_code, sort_order } = req.body;
    if (!zone_name) return res.status(400).json({ error: '구역명 필수' });
    const house = await query(`SELECT TOP 1 item_id FROM apt_item WHERE node_type='H'`);
    if (!house[0]) return res.status(400).json({ error: '우리집 노드 없음' });
    const houseId = house[0].item_id;

    const p = await getPool();
    const sortVal = sort_order ?? (await query(`SELECT ISNULL(MAX(i.sort_order),0)+1 AS nxt FROM apt_item i JOIN apt_bom b ON b.child_item_id=i.item_id WHERE b.parent_item_id=${houseId}`))[0].nxt;
    const defCat = (await query(`SELECT TOP 1 cat_id FROM apt_category WHERE parent_cat_id IS NOT NULL ORDER BY sort_order`))[0]?.cat_id || 1;

    const r = await p.request().query(`
      INSERT INTO apt_item (item_code, item_name, node_type, cat_id, sort_order, use_yn)
      VALUES ('TMP-${Date.now()}', N'${zone_name}', 'Z', ${defCat}, ${sortVal}, 'Y');
      SELECT SCOPE_IDENTITY() AS item_id`);
    const itemId = r.recordset[0].item_id;
    const finalCode = zone_code?.trim() || `Z${String(itemId).padStart(6, '0')}`;
    await query('UPDATE apt_item SET item_code=@c WHERE item_id=@id', { c: finalCode, id: itemId });

    const br = await p.request().query(`
      INSERT INTO apt_bom (parent_item_id, child_item_id, qty, is_required, sort_order, level_no)
      VALUES (${houseId}, ${itemId}, 1, 'N', ${sortVal}, 0);
      SELECT SCOPE_IDENTITY() AS bom_id`);

    res.json({ zone_id: itemId, item_id: itemId, bom_id: br.recordset[0].bom_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/zones/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { zone_name, zone_code, sort_order } = req.body;
    if (!zone_name) return res.status(400).json({ error: '구역명 필수' });
    const codeSet = zone_code?.trim() ? ', item_code=@code' : '';
    await query(
      `UPDATE apt_item SET item_name=@name, sort_order=@sort${codeSet} WHERE item_id=@id AND node_type='Z'`,
      { name: zone_name, sort: sort_order ?? 0, ...(zone_code?.trim() ? { code: zone_code.trim() } : {}), id: itemId }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/zones/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    // zone의 BOM bom_id를 찾아 cascade delete
    const bom = await query(`SELECT bom_id FROM apt_bom WHERE child_item_id=@id`, { id: itemId });
    if (bom[0]) {
      await cascadeDeleteBom(bom[0].bom_id);
    } else {
      await query(`DELETE FROM apt_item WHERE item_id=@id AND node_type='Z'`, { id: itemId });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   Item CRUD
══════════════════════════════════════════════════════════ */
app.post('/api/items', async (req, res) => {
  try {
    const { parent_item_id, item_name, item_code,
            unit, std_price, brand, spec, note, qty, is_required, cat_id } = req.body;
    if (!item_name) return res.status(400).json({ error: '항목명 필수' });
    if (!parent_item_id) return res.status(400).json({ error: '상위 항목 필수' });

    const p = await getPool();

    let cid = parseInt(cat_id) || 0;
    if (!cid) {
      const cats = await query(`SELECT TOP 1 cat_id FROM apt_category WHERE parent_cat_id IS NOT NULL ORDER BY sort_order`);
      cid = cats[0]?.cat_id || 1;
    }

    const sortRows = await query(
      `SELECT ISNULL(MAX(sort_order),0)+1 AS nxt FROM apt_bom WHERE parent_item_id=@p`,
      { p: parent_item_id });
    const sortOrder = sortRows[0]?.nxt || 1;

    const lvRow = await query(`SELECT level_no FROM apt_bom WHERE child_item_id=@p`, { p: parent_item_id });
    const levelNo = (lvRow[0]?.level_no ?? 0) + 1;

    const r1 = await p.request().query(`
      INSERT INTO apt_item (item_code, item_name, node_type, cat_id, unit, std_price, brand, spec, note, sort_order, use_yn)
      VALUES ('TMP-${Date.now()}', N'${item_name}', 'I', ${cid},
              '${unit || 'EA'}', ${std_price || 0},
              ${brand ? `N'${brand}'` : 'NULL'},
              ${spec  ? `N'${spec}'`  : 'NULL'},
              ${note  ? `N'${note}'`  : 'NULL'},
              ${sortOrder}, 'Y');
      SELECT SCOPE_IDENTITY() AS item_id`);
    const item_id = r1.recordset[0].item_id;

    const finalCode = item_code?.trim() || `I${String(item_id).padStart(6, '0')}`;
    await query('UPDATE apt_item SET item_code=@c WHERE item_id=@id', { c: finalCode, id: item_id });

    const r2 = await p.request().query(`
      INSERT INTO apt_bom (parent_item_id, child_item_id, qty, is_required, level_no, sort_order)
      VALUES (${parent_item_id}, ${item_id}, ${qty || 1}, '${is_required || 'N'}', ${levelNo}, ${sortOrder});
      SELECT SCOPE_IDENTITY() AS bom_id`);

    res.json({ ok: true, item_id, bom_id: r2.recordset[0].bom_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const item_id = parseInt(req.params.id);
    const { item_name, unit, std_price, brand, spec, note, qty, is_required, bom_id } = req.body;
    await query(
      `UPDATE apt_item SET item_name=@name,unit=@unit,std_price=@price,brand=@brand,spec=@spec,note=@note WHERE item_id=@id`,
      { name: item_name, unit: unit||'EA', price: std_price||0,
        brand: brand||null, spec: spec||null, note: note||null, id: item_id }
    );
    if (bom_id) {
      await query(`UPDATE apt_bom SET qty=@qty,is_required=@req WHERE bom_id=@bid`,
                  { qty: qty||1, req: is_required||'N', bid: parseInt(bom_id) });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* BOM 재귀 삭제 + 고아 아이템 정리 */
async function cascadeDeleteBom(bomId) {
  const p = await getPool();
  // 삭제할 BOM ID + item_id 수집
  const collected = await p.request().query(`
    WITH CTE AS (
      SELECT bom_id, child_item_id FROM apt_bom WHERE bom_id=${bomId}
      UNION ALL
      SELECT b.bom_id, b.child_item_id FROM apt_bom b INNER JOIN CTE c ON b.parent_item_id=c.child_item_id
    )
    SELECT bom_id, child_item_id FROM CTE`);
  const bomIds  = collected.recordset.map(r => r.bom_id);
  const itemIds = collected.recordset.map(r => r.child_item_id);
  if (bomIds.length)  await p.request().query(`DELETE FROM apt_bom  WHERE bom_id  IN (${bomIds.join(',')})`);
  if (itemIds.length) await p.request().query(`DELETE FROM apt_item WHERE item_id IN (${itemIds.join(',')}) AND item_id NOT IN (SELECT child_item_id FROM apt_bom)`);
}

app.delete('/api/bom/:id', async (req, res) => {
  try {
    await cascadeDeleteBom(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   테이블 초기화
══════════════════════════════════════════════════════════ */
async function initTables() {
  try {
    const p = await getPool();
    await p.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='apt_floorplan')
      CREATE TABLE apt_floorplan (
        fp_id       INT IDENTITY(1,1) PRIMARY KEY,
        fp_name     NVARCHAR(100) NOT NULL,
        fp_building NVARCHAR(50),
        fp_unit     NVARCHAR(20),
        fp_area     NVARCHAR(20),
        img_path    NVARCHAR(300),
        created_at  DATETIME DEFAULT GETDATE()
      )`);
    await p.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='apt_fp_zone')
      CREATE TABLE apt_fp_zone (
        fpz_id  INT IDENTITY(1,1) PRIMARY KEY,
        fp_id   INT NOT NULL,
        zone_id INT,
        label   NVARCHAR(100) NOT NULL,
        coords  NVARCHAR(MAX) NOT NULL,
        color   NVARCHAR(20) DEFAULT '#3b82f6'
      )`);
    console.log('테이블 초기화 완료');
  } catch(e) { console.error('테이블 초기화 오류:', e.message); }
}

/* ══════════════════════════════════════════════════════════
   평면도 CRUD
══════════════════════════════════════════════════════════ */
app.get('/api/floorplans', async (_req, res) => {
  try { res.json(await query('SELECT * FROM apt_floorplan ORDER BY created_at DESC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/floorplans', async (req, res) => {
  try {
    const { fp_name, fp_building, fp_unit, fp_area, image_base64 } = req.body;
    if (!fp_name) return res.status(400).json({ error: '도면명 필수' });
    let img_path = null;
    if (image_base64) {
      const m = image_base64.match(/^data:([^;]+);base64,(.+)$/s);
      if (m) {
        const fname = `fp_${Date.now()}.${m[1].split('/')[1]||'jpg'}`;
        fs.writeFileSync(path.join(UPLOAD_DIR, fname), Buffer.from(m[2], 'base64'));
        img_path = `/uploads/${fname}`;
      }
    }
    const p = await getPool();
    const r = p.request();
    r.input('name', fp_name); r.input('bld', fp_building||null);
    r.input('unit', fp_unit||null); r.input('area', fp_area||null); r.input('img', img_path);
    const result = await r.query(`INSERT INTO apt_floorplan (fp_name,fp_building,fp_unit,fp_area,img_path) OUTPUT INSERTED.fp_id VALUES (@name,@bld,@unit,@area,@img)`);
    res.json({ fp_id: result.recordset[0].fp_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/floorplans/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await query('SELECT img_path FROM apt_floorplan WHERE fp_id=@id', { id });
    if (rows[0]?.img_path) { const fp = path.join(__dirname,'public',rows[0].img_path); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    await query('DELETE FROM apt_fp_zone   WHERE fp_id=@id', { id });
    await query('DELETE FROM apt_floorplan WHERE fp_id=@id', { id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 평면도 구역 (zone_id는 이제 apt_item.item_id 참조) */
app.get('/api/floorplans/:id/zones', async (req, res) => {
  try {
    const rows = await query(`
      SELECT fz.fpz_id, fz.fp_id, fz.zone_id, fz.label, fz.coords, fz.color,
             i.item_name AS zone_name
      FROM apt_fp_zone fz
      LEFT JOIN apt_item i ON i.item_id = fz.zone_id
      WHERE fz.fp_id = @id`, { id: parseInt(req.params.id) });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/floorplans/:id/zones', async (req, res) => {
  try {
    const { label, zone_id, coords, color } = req.body;
    const p = await getPool(); const r = p.request();
    r.input('fp', parseInt(req.params.id)); r.input('label', label);
    r.input('zone', zone_id||null); r.input('coords', JSON.stringify(coords)); r.input('color', color||'#3b82f6');
    const result = await r.query(`INSERT INTO apt_fp_zone (fp_id,zone_id,label,coords,color) OUTPUT INSERTED.fpz_id VALUES (@fp,@zone,@label,@coords,@color)`);
    res.json({ fpz_id: result.recordset[0].fpz_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/fp-zones/:id', async (req, res) => {
  try {
    const { label, zone_id, coords, color } = req.body;
    await query(`UPDATE apt_fp_zone SET label=@label,zone_id=@zone,coords=@coords,color=@color WHERE fpz_id=@id`,
      { label, zone: zone_id||null, coords: JSON.stringify(coords), color: color||'#3b82f6', id: parseInt(req.params.id) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/fp-zones/:id', async (req, res) => {
  try {
    await query('DELETE FROM apt_fp_zone WHERE fpz_id=@id', { id: parseInt(req.params.id) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* 한글 설명 일괄 등록 */
app.post('/api/migrate-descriptions', async (_req, res) => {
  const defs = [
    { tbl:'apt_item', tblDesc:'항목(통합BOM노드)', cols:{ item_id:'항목ID', item_code:'항목코드', item_name:'항목명', node_type:'노드유형(H/Z/I)', cat_id:'분류ID', unit:'단위', std_price:'기준단가', brand:'브랜드', spec:'규격', note:'비고', use_yn:'사용여부', sort_order:'정렬순서' } },
    { tbl:'apt_bom',  tblDesc:'BOM관계',          cols:{ bom_id:'BOMID', parent_item_id:'상위항목ID', child_item_id:'하위항목ID', qty:'수량', is_required:'필수여부', level_no:'레벨번호', sort_order:'정렬순서', note:'비고' } },
    { tbl:'apt_category', tblDesc:'분류', cols:{ cat_id:'분류ID', cat_code:'분류코드', cat_name:'분류명', parent_cat_id:'상위분류ID', sort_order:'정렬순서' } },
  ];
  try {
    const p = await getPool();
    const addProp = async (value, tbl, col) => {
      const sql = `
        IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('${tbl}')
          AND minor_id=${col?`(SELECT column_id FROM sys.columns WHERE object_id=OBJECT_ID('${tbl}') AND name='${col}')`:'0'}
          AND name=N'MS_Description')
          EXEC sp_addextendedproperty @name=N'MS_Description',@value=N'${value}',
            @level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'${tbl}'${col?`,@level2type=N'COLUMN',@level2name=N'${col}'`:''}
        ELSE
          EXEC sp_updateextendedproperty @name=N'MS_Description',@value=N'${value}',
            @level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'${tbl}'${col?`,@level2type=N'COLUMN',@level2name=N'${col}'`:''}`;
      await p.request().query(sql);
    };
    for (const { tbl, tblDesc, cols } of defs) {
      await addProp(tblDesc, tbl, null);
      for (const [col, desc] of Object.entries(cols)) await addProp(desc, tbl, col);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, async () => {
  await initTables();
  console.log('서버 실행 중 → http://localhost:3000');
});
