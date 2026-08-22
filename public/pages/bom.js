const fmt = n => Number(n).toLocaleString();

async function loadBom() {
  const zone     = document.getElementById('selZone')?.value || '';
  const category = document.getElementById('selCat')?.value || '';
  const required = document.getElementById('chkRequired')?.checked ? 'Y' : '';

  const params = new URLSearchParams();
  if (zone)     params.set('zone', zone);
  if (category) params.set('category', category);
  if (required) params.set('required', required);

  const tbody = document.getElementById('bomTable');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" class="loading">조회 중...</td></tr>';

  const data = await fetch('/api/bom?' + params).then(r => r.json());
  document.getElementById('tableInfo').textContent = `총 ${data.length}건`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="loading">결과 없음</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td><span class="zone-tag">${row.zone_name}</span></td>
      <td>${row.cat_name}</td>
      <td style="font-family:Consolas;font-size:12px">${row.item_code}</td>
      <td>${row.item_name}</td>
      <td style="text-align:center">${row.qty}</td>
      <td style="text-align:center">${row.unit}</td>
      <td class="price">${fmt(row.std_price)}</td>
      <td class="price">${fmt(row.std_price * row.qty)}</td>
      <td><span class="badge badge-${row.is_required === 'Y' ? 'y' : 'n'}">${row.is_required === 'Y' ? '필수' : '선택'}</span></td>
    </tr>
  `).join('');
}

function resetBom() {
  document.getElementById('selZone').value = '';
  document.getElementById('selCat').value = '';
  document.getElementById('chkRequired').checked = false;
  loadBom();
}

// 인라인 onclick에서 접근할 수 있도록 전역 등록
window._bom = { loadBom, resetBom };

export const page = {
  icon: '🏠',
  title: '홈 인벤토리',
  async render(el) {
    const [zones, cats] = await Promise.all([
      fetch('/api/zones').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]);

    el.innerHTML = `
      <div class="filter-bar">
        <select id="selZone">
          <option value="">구역 전체</option>
          ${zones.map(z => `<option value="${z.zone_id}">${z.zone_name}</option>`).join('')}
        </select>
        <select id="selCat">
          <option value="">카테고리 전체</option>
          ${cats.map(c => `<option value="${c.cat_id}">${c.cat_name}</option>`).join('')}
        </select>
        <label><input type="checkbox" id="chkRequired"> 필수만 보기</label>
        <button class="btn" onclick="window._bom.loadBom()">조회</button>
        <button class="btn btn-reset" onclick="window._bom.resetBom()">초기화</button>
      </div>
      <div class="table-wrap">
        <div class="table-info" id="tableInfo">조회 중...</div>
        <table>
          <thead>
            <tr>
              <th>구역</th><th>카테고리</th><th>물품코드</th><th>물품명</th>
              <th>수량</th><th>단위</th>
              <th style="text-align:right">단가</th>
              <th style="text-align:right">금액</th>
              <th>필수</th>
            </tr>
          </thead>
          <tbody id="bomTable"><tr><td colspan="9" class="loading">조회 중...</td></tr></tbody>
        </table>
      </div>
    `;

    loadBom();
  }
};
