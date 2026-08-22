/*
 * api-local.js — fetch 인터셉터
 * @version 1.2.0
 *
 * window.fetch를 오버라이드해서 /api/* 요청을
 * Google Drive 로컬 처리로 대체한다.
 * index.html에서 다른 페이지 스크립트보다 먼저 로드해야 함.
 */
(function () {
  const _orig = window.fetch.bind(window);

  /* 응답 생성 헬퍼 */
  const ok  = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const err = (msg,  status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });

  /* 요청 바디 파싱 */
  async function parseBody(opts) {
    if (!opts?.body) return {};
    try { return JSON.parse(typeof opts.body === 'string' ? opts.body : await new Response(opts.body).text()); }
    catch { return {}; }
  }

  /* 경로 패턴 매칭 — /api/zones/:id → [전체, id값] */
  function match(pattern, path) {
    const re = new RegExp('^' + pattern.replace(/:\w+/g, '([^/?]+)') + '$');
    return path.match(re);
  }

  /* BOM cascade 삭제 */
  function cascadeDel(db, bomId) {
    const queue = [bomId];
    const delB  = new Set();
    const delI  = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (delB.has(id)) continue;
      const b = db.bom.find(x => x.bom_id === id);
      if (!b) continue;
      delB.add(id); delI.add(b.child_item_id);
      db.bom.filter(x => x.parent_item_id === b.child_item_id).forEach(x => queue.push(x.bom_id));
    }
    db.bom   = db.bom.filter(b => !delB.has(b.bom_id));
    db.items = db.items.filter(i => !delI.has(i.item_id));
  }

  /* 기본 카테고리 ID */
  function defCat(db) {
    return db.categories.find(c => c.parent_cat_id !== null)?.cat_id || 2;
  }

  /* ── 메인 인터셉터 ────────────────────────────────── */
  window.fetch = async function (url, opts = {}) {
    if (typeof url !== 'string' || !url.startsWith('/api/')) return _orig(url, opts);

    try {
      const db  = SmartDrive.getDb() || await SmartDrive.loadDb();
      const mtd = (opts.method || 'GET').toUpperCase();
      const path = url.split('?')[0];
      const qs   = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
      let m;

      /* ── 읽기 API ── */

      if (mtd === 'GET' && match('/api/bom-tree', path)) {
        const reqOnly = qs.get('required') === 'Y';
        const bom = reqOnly ? db.bom.filter(b => b.is_required === 'Y') : db.bom;
        const houses = db.items.filter(i => i.node_type === 'H');
        const rows = bom.map(b => {
          const i = db.items.find(i => i.item_id === b.child_item_id);
          return i ? { ...i, ...b, item_sort: i.sort_order } : null;
        }).filter(Boolean);
        const houseRows = houses.map(h => ({
          bom_id: null, parent_item_id: null, ...h,
          qty: 1, is_required: 'N', sort_order: h.sort_order || 0, level_no: -1
        }));
        return ok([...houseRows, ...rows]);
      }

      if (mtd === 'GET' && match('/api/zones', path)) {
        const zones = db.items
          .filter(i => i.node_type === 'Z')
          .map(i => {
            const b     = db.bom.find(b => b.child_item_id === i.item_id);
            const house = b ? db.items.find(h => h.item_id === b.parent_item_id && h.node_type === 'H') : null;
            return { bom_id: b?.bom_id, zone_id: i.item_id, zone_code: i.item_code, zone_name: i.item_name,
                     sort_order: i.sort_order, house_id: house?.item_id||null, house_name: house?.item_name||null };
          })
          .sort((a, b) => a.sort_order - b.sort_order);
        return ok(zones);
      }

      if (mtd === 'GET' && match('/api/house', path)) {
        const h = db.items.find(i => i.node_type === 'H');
        return ok(h
          ? { house_id: h.item_id, house_code: h.item_code, house_name: h.item_name }
          : { house_id: null, house_code: 'H000001', house_name: '우리집' });
      }

      if (mtd === 'GET' && match('/api/categories', path)) {
        return ok(db.categories.filter(c => c.parent_cat_id !== null).sort((a, b) => a.sort_order - b.sort_order));
      }

      if (mtd === 'GET' && match('/api/cost', path)) {
        const result = db.items.filter(i => i.node_type === 'Z').map(z => {
          const ch  = db.bom.filter(b => b.parent_item_id === z.item_id);
          const sum = (filter) => ch.filter(filter).reduce((s, b) => {
            const i = db.items.find(i => i.item_id === b.child_item_id);
            return s + (i?.std_price || 0) * (b.qty || 1);
          }, 0);
          const req   = sum(b => b.is_required === 'Y');
          const opt   = sum(b => b.is_required !== 'Y');
          const hBom  = db.bom.find(b => b.child_item_id === z.item_id);
          const house = hBom ? db.items.find(h => h.item_id === hBom.parent_item_id && h.node_type === 'H') : null;
          return { zone_name: z.item_name, house_name: house?.item_name||null, req_cost: req, opt_cost: opt, total_cost: req + opt };
        }).filter(z => z.total_cost > 0);
        return ok(result);
      }

      if (mtd === 'GET' && match('/api/bom', path)) {
        const zoneId = parseInt(qs.get('zone'));
        if (!zoneId) return ok([]);
        const rows = db.bom.filter(b => b.parent_item_id === zoneId).map(b => {
          const i = db.items.find(i => i.item_id === b.child_item_id);
          return i ? { ...i, ...b } : null;
        }).filter(Boolean);
        return ok(rows);
      }

      /* ── 구역 CRUD ── */

      /* ── 집 CRUD ── */

      if (mtd === 'POST' && match('/api/houses', path)) {
        const bd = await parseBody(opts);
        if (!bd.house_name) return err('집 이름 필수');
        const id   = SmartDrive.nextId();
        const code = bd.house_code?.trim() || `H${String(id).padStart(6, '0')}`;
        const sort = bd.sort_order ?? db.items.filter(i => i.node_type === 'H').length;
        db.items.push({ item_id: id, node_type: 'H', item_code: code, item_name: bd.house_name,
          cat_id: defCat(db), unit: 'EA', std_price: 0, brand: null, spec: null, note: null,
          sort_order: sort, use_yn: 'Y' });
        await SmartDrive.saveDb();
        return ok({ item_id: id });
      }

      if (mtd === 'PUT' && (m = match('/api/houses/:id', path))) {
        const bd  = await parseBody(opts);
        if (!bd.house_name) return err('집 이름 필수');
        const idx = db.items.findIndex(i => i.item_id === parseInt(m[1]) && i.node_type === 'H');
        if (idx >= 0) {
          db.items[idx].item_name = bd.house_name;
          if (bd.house_code?.trim()) db.items[idx].item_code = bd.house_code.trim().toUpperCase();
        }
        await SmartDrive.saveDb();
        return ok({ ok: true });
      }

      if (mtd === 'DELETE' && (m = match('/api/houses/:id', path))) {
        const houseId = parseInt(m[1]);
        const queue   = db.bom.filter(b => b.parent_item_id === houseId).map(b => b.bom_id);
        const delB    = new Set();
        const delI    = new Set([houseId]);
        while (queue.length) {
          const bid = queue.shift();
          if (delB.has(bid)) continue;
          const b = db.bom.find(x => x.bom_id === bid);
          if (!b) continue;
          delB.add(bid); delI.add(b.child_item_id);
          db.bom.filter(x => x.parent_item_id === b.child_item_id).forEach(x => queue.push(x.bom_id));
        }
        db.bom   = db.bom.filter(b => !delB.has(b.bom_id));
        db.items = db.items.filter(i => !delI.has(i.item_id));
        await SmartDrive.saveDb();
        return ok({ ok: true });
      }

      if (mtd === 'POST' && match('/api/zones', path)) {
        const bd = await parseBody(opts);
        if (!bd.zone_name) return err('구역명 필수');
        const house = bd.house_id
          ? db.items.find(i => i.item_id === parseInt(bd.house_id) && i.node_type === 'H')
          : db.items.find(i => i.node_type === 'H');
        if (!house) return err('집 노드 없음');
        const sort  = bd.sort_order ?? (Math.max(0, ...db.bom.filter(b => b.parent_item_id === house.item_id).map(b => b.sort_order || 0)) + 1);
        const id    = SmartDrive.nextId();
        const code  = bd.zone_code?.trim() || `Z${String(id).padStart(6, '0')}`;
        db.items.push({ item_id: id, node_type: 'Z', item_code: code, item_name: bd.zone_name, cat_id: defCat(db), unit: 'EA', std_price: 0, brand: null, spec: null, note: null, sort_order: sort, use_yn: 'Y' });
        const bomId = SmartDrive.nextId();
        db.bom.push({ bom_id: bomId, parent_item_id: house.item_id, child_item_id: id, qty: 1, is_required: 'N', sort_order: sort, level_no: 0 });
        await SmartDrive.saveDb();
        return ok({ zone_id: id, item_id: id, bom_id: bomId });
      }

      if (mtd === 'PUT' && (m = match('/api/zones/:id', path))) {
        const bd = await parseBody(opts);
        if (!bd.zone_name) return err('구역명 필수');
        const idx = db.items.findIndex(i => i.item_id === parseInt(m[1]) && i.node_type === 'Z');
        if (idx >= 0) {
          db.items[idx].item_name = bd.zone_name;
          if (bd.zone_code?.trim()) db.items[idx].item_code = bd.zone_code.trim();
          if (bd.sort_order !== undefined) db.items[idx].sort_order = bd.sort_order;
        }
        await SmartDrive.saveDb();
        return ok({ ok: true });
      }

      if (mtd === 'DELETE' && (m = match('/api/zones/:id', path))) {
        const id = parseInt(m[1]);
        const b  = db.bom.find(b => b.child_item_id === id);
        b ? cascadeDel(db, b.bom_id) : (db.items = db.items.filter(i => i.item_id !== id));
        await SmartDrive.saveDb();
        return ok({ ok: true });
      }

      /* ── 항목 CRUD ── */

      if (mtd === 'POST' && match('/api/items', path)) {
        const bd = await parseBody(opts);
        if (!bd.item_name)      return err('항목명 필수');
        if (!bd.parent_item_id) return err('상위 항목 필수');
        const sort      = Math.max(0, ...db.bom.filter(b => b.parent_item_id === bd.parent_item_id).map(b => b.sort_order || 0)) + 1;
        const parentBom = db.bom.find(b => b.child_item_id === bd.parent_item_id);
        const level     = (parentBom?.level_no ?? -1) + 1;
        const id        = SmartDrive.nextId();
        const code      = bd.item_code?.trim() || `I${String(id).padStart(6, '0')}`;
        db.items.push({ item_id: id, node_type: 'I', item_code: code, item_name: bd.item_name, cat_id: bd.cat_id || defCat(db), unit: bd.unit || 'EA', std_price: bd.std_price || 0, brand: bd.brand || null, spec: bd.spec || null, note: bd.note || null, sort_order: sort, use_yn: 'Y' });
        const bomId = SmartDrive.nextId();
        db.bom.push({ bom_id: bomId, parent_item_id: bd.parent_item_id, child_item_id: id, qty: bd.qty || 1, is_required: bd.is_required || 'N', level_no: level, sort_order: sort });
        await SmartDrive.saveDb();
        return ok({ ok: true, item_id: id, bom_id: bomId });
      }

      if (mtd === 'PUT' && (m = match('/api/items/:id', path))) {
        const bd  = await parseBody(opts);
        const idx = db.items.findIndex(i => i.item_id === parseInt(m[1]));
        if (idx >= 0) Object.assign(db.items[idx], { item_name: bd.item_name, unit: bd.unit || 'EA', std_price: bd.std_price || 0, brand: bd.brand || null, spec: bd.spec || null, note: bd.note || null });
        if (bd.bom_id) {
          const bi = db.bom.findIndex(b => b.bom_id === parseInt(bd.bom_id));
          if (bi >= 0) Object.assign(db.bom[bi], { qty: bd.qty || 1, is_required: bd.is_required || 'N' });
        }
        await SmartDrive.saveDb();
        return ok({ ok: true });
      }

      if (mtd === 'DELETE' && (m = match('/api/bom/:id', path))) {
        cascadeDel(db, parseInt(m[1]));
        await SmartDrive.saveDb();
        return ok({ ok: true });
      }

      /* ── 도면 CRUD ── */

      if (mtd === 'GET' && match('/api/floorplans', path)) {
        const list = await Promise.all(db.floorplans.map(async fp => {
          let img_path = null;
          if (fp.drive_file_id) {
            try { img_path = await SmartDrive.getImageUrl(fp.drive_file_id); } catch {}
          }
          return { ...fp, img_path };
        }));
        return ok(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      }

      if (mtd === 'POST' && match('/api/floorplans', path)) {
        const bd = await parseBody(opts);
        if (!bd.fp_name) return err('도면명 필수');
        const id = SmartDrive.nextId();
        let drive_file_id = null;
        if (bd.image_base64) {
          const ext = bd.image_base64.match(/^data:image\/(\w+)/)?.[1] || 'png';
          try { drive_file_id = await SmartDrive.uploadImage(bd.image_base64, `fp_${id}.${ext}`); } catch {}
        }
        db.floorplans.push({ fp_id: id, fp_name: bd.fp_name, fp_building: bd.fp_building || null, fp_unit: bd.fp_unit || null, fp_area: bd.fp_area || null, drive_file_id, created_at: new Date().toISOString() });
        await SmartDrive.saveDb();
        return ok({ fp_id: id });
      }

      if (mtd === 'DELETE' && (m = match('/api/floorplans/:id', path))) {
        const id = parseInt(m[1]);
        const fp = db.floorplans.find(f => f.fp_id === id);
        if (fp?.drive_file_id) try { await SmartDrive.deleteFile(fp.drive_file_id); } catch {}
        db.floorplans = db.floorplans.filter(f => f.fp_id !== id);
        db.fpZones    = db.fpZones.filter(z => z.fp_id !== id);
        await SmartDrive.saveDb();
        return ok({ ok: true });
      }

      /* ── 도면 영역 CRUD ── */

      if (mtd === 'GET' && (m = match('/api/floorplans/:id/zones', path))) {
        const fpId = parseInt(m[1]);
        const rows = db.fpZones.filter(z => z.fp_id === fpId).map(z => {
          const item = db.items.find(i => i.item_id === z.zone_id);
          return { ...z, zone_name: item?.item_name || null };
        });
        return ok(rows);
      }

      if (mtd === 'POST' && (m = match('/api/floorplans/:id/zones', path))) {
        const bd  = await parseBody(opts);
        const id  = SmartDrive.nextId();
        db.fpZones.push({ fpz_id: id, fp_id: parseInt(m[1]), zone_id: bd.zone_id || null, label: bd.label, coords: JSON.stringify(bd.coords), color: bd.color || '#3b82f6' });
        await SmartDrive.saveDb();
        return ok({ fpz_id: id });
      }

      if (mtd === 'PUT' && (m = match('/api/fp-zones/:id', path))) {
        const bd  = await parseBody(opts);
        const idx = db.fpZones.findIndex(z => z.fpz_id === parseInt(m[1]));
        if (idx >= 0) Object.assign(db.fpZones[idx], { label: bd.label, zone_id: bd.zone_id || null, coords: JSON.stringify(bd.coords), color: bd.color || '#3b82f6' });
        await SmartDrive.saveDb();
        return ok({ ok: true });
      }

      if (mtd === 'DELETE' && (m = match('/api/fp-zones/:id', path))) {
        db.fpZones = db.fpZones.filter(z => z.fpz_id !== parseInt(m[1]));
        await SmartDrive.saveDb();
        return ok({ ok: true });
      }

      return err('Not found', 404);

    } catch (e) {
      console.error('[api-local]', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  };
})();
