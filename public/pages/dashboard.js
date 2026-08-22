const fmt = n => Number(n).toLocaleString();

export const page = {
  icon: '📊',
  title: '대시보드',
  async render(el) {
    el.innerHTML = '<div class="loading">로딩 중...</div>';

    const [zones, cats, cost] = await Promise.all([
      fetch('/api/zones').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/cost').then(r => r.json()),
    ]);

    const totalCost = cost.reduce((s, r) => s + Number(r.total_cost), 0);

    el.innerHTML = `
      <div class="dash-kpi">
        <div class="kpi-card">
          <div class="kpi-label">구역 수</div>
          <div class="kpi-value">${zones.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">카테고리 수</div>
          <div class="kpi-value">${cats.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">총 예상 비용</div>
          <div class="kpi-value" style="font-size:18px">${fmt(totalCost)} 원</div>
        </div>
      </div>

      <div class="dash-section">
        <h3>바로가기</h3>
        <div class="quick-grid">
          <button class="quick-btn" onclick="navigate('홈인벤토리')">
            <span class="icon">🏠</span>
            <span class="name">홈 인벤토리</span>
          </button>
        </div>
      </div>

      <div class="dash-section">
        <h3>구역별 비용 요약</h3>
        <div class="cost-grid">
          ${cost.map(r => `
            <div class="cost-card">
              <div class="zone">${r.zone_name}</div>
              <div class="row"><span>필수</span><span>${fmt(r.req_cost)}</span></div>
              <div class="row"><span>선택</span><span>${fmt(r.opt_cost)}</span></div>
              <div class="row total"><span>합계</span><span>${fmt(r.total_cost)}</span></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};
