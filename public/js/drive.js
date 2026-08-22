/*
 * drive.js — Google Drive API v3 래퍼
 * @version 1.0.0
 *
 * 개인 Google Drive의 SmartApt/ 폴더에 모든 데이터 저장
 *   SmartApt/db.json      — 구역·항목·BOM·도면 메타
 *   SmartApt/fp_*.png     — 평면도 이미지
 */

const _DRIVE  = 'https://www.googleapis.com/drive/v3';
const _UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const _FOLDER = 'SmartApt';
const _DB     = 'db.json';

window.SmartDrive = {
  _folderId : null,
  _dbFileId : null,
  _db       : null,
  _imgCache : new Map(),   // fileId → blobUrl

  _hdr() {
    return { Authorization: `Bearer ${SmartAuth.getToken()}` };
  },

  /* SmartApt 폴더 찾기/생성 */
  async _folder() {
    if (this._folderId) return this._folderId;
    const q = `name='${_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const r = await fetch(`${_DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id)`, { headers: this._hdr() });
    const d = await r.json();
    if (d.files?.length) { this._folderId = d.files[0].id; return this._folderId; }
    const cr = await fetch(`${_DRIVE}/files`, {
      method: 'POST',
      headers: { ...this._hdr(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: _FOLDER, mimeType: 'application/vnd.google-apps.folder' })
    });
    this._folderId = (await cr.json()).id;
    return this._folderId;
  },

  /* db.json 로드 (없으면 seed 생성) */
  async loadDb() {
    const fid = await this._folder();
    const q   = `name='${_DB}' and '${fid}' in parents and trashed=false`;
    const r   = await fetch(`${_DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id)`, { headers: this._hdr() });
    const d   = await r.json();

    if (d.files?.length) {
      this._dbFileId = d.files[0].id;
      const fr = await fetch(`${_DRIVE}/files/${this._dbFileId}?alt=media`, { headers: this._hdr() });
      this._db = await fr.json();
    } else {
      this._db = this._seed();
      await this.saveDb();
    }
    return this._db;
  },

  /* db.json 저장 */
  async saveDb() {
    const fid  = await this._folder();
    const blob = new Blob([JSON.stringify(this._db)], { type: 'application/json' });

    if (this._dbFileId) {
      await fetch(`${_UPLOAD}/files/${this._dbFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { ...this._hdr(), 'Content-Type': 'application/json' },
        body: blob
      });
    } else {
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: _DB, parents: [fid] })], { type: 'application/json' }));
      form.append('file', blob);
      const cr = await fetch(`${_UPLOAD}/files?uploadType=multipart&fields=id`, {
        method: 'POST', headers: this._hdr(), body: form
      });
      this._dbFileId = (await cr.json()).id;
    }
  },

  getDb() { return this._db; },

  nextId() {
    this._db.nextId = (this._db.nextId || 100) + 1;
    return this._db.nextId;
  },

  /* 이미지 Drive 업로드 → fileId 반환 */
  async uploadImage(base64, filename) {
    const fid = await this._folder();
    const m   = base64.match(/^data:([^;]+);base64,(.+)$/s);
    if (!m) return null;
    const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: m[1] });
    const form  = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: filename, parents: [fid] })], { type: 'application/json' }));
    form.append('file', blob);
    const r = await fetch(`${_UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST', headers: this._hdr(), body: form
    });
    return (await r.json()).id;
  },

  /* Drive 이미지 → Blob URL (세션 내 캐시) */
  async getImageUrl(fileId) {
    if (this._imgCache.has(fileId)) return this._imgCache.get(fileId);
    const r   = await fetch(`${_DRIVE}/files/${fileId}?alt=media`, { headers: this._hdr() });
    const url = URL.createObjectURL(await r.blob());
    this._imgCache.set(fileId, url);
    return url;
  },

  /* Drive 파일 삭제 */
  async deleteFile(fileId) {
    await fetch(`${_DRIVE}/files/${fileId}`, { method: 'DELETE', headers: this._hdr() });
    if (this._imgCache.has(fileId)) {
      URL.revokeObjectURL(this._imgCache.get(fileId));
      this._imgCache.delete(fileId);
    }
  },

  /* 로그아웃 시 초기화 */
  reset() {
    this._imgCache.forEach(url => URL.revokeObjectURL(url));
    this._folderId = null;
    this._dbFileId = null;
    this._db       = null;
    this._imgCache.clear();
  },

  /* 최초 db.json 기본값 */
  _seed() {
    return {
      nextId: 10,
      items: [
        { item_id: 1, node_type: 'H', item_code: 'H000001', item_name: '우리집',
          cat_id: 1, unit: 'EA', std_price: 0, brand: null, spec: null, note: null,
          sort_order: 0, use_yn: 'Y' }
      ],
      bom: [],
      categories: [
        { cat_id: 1, cat_code: 'ROOT', cat_name: '전체',     parent_cat_id: null, sort_order: 0 },
        { cat_id: 2, cat_code: 'LIVE', cat_name: '생활가전', parent_cat_id: 1,    sort_order: 1 },
        { cat_id: 3, cat_code: 'FURN', cat_name: '가구',     parent_cat_id: 1,    sort_order: 2 },
        { cat_id: 4, cat_code: 'KITC', cat_name: '주방용품', parent_cat_id: 1,    sort_order: 3 },
        { cat_id: 5, cat_code: 'BATH', cat_name: '욕실용품', parent_cat_id: 1,    sort_order: 4 },
        { cat_id: 6, cat_code: 'ELEC', cat_name: '전자기기', parent_cat_id: 1,    sort_order: 5 },
        { cat_id: 7, cat_code: 'ETC',  cat_name: '기타',     parent_cat_id: 1,    sort_order: 6 }
      ],
      floorplans: [],
      fpZones: []
    };
  }
};
