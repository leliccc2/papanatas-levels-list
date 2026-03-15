// level.js - level detail page: merges base records + overrides from localStorage and updates when overrides change
(function(){

  function qs(key){
    const p = new URLSearchParams(location.search);
    return p.get(key);
  }

  const levelID = qs("id");
  const container = document.getElementById("levelContent");

  if(!levelID){
    if(container) container.innerHTML = "<p style='color:var(--muted)'>Nivel no encontrado.</p>";
    throw new Error('No level id');
  }

  // helper escape
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // difficulty icon filename helper
  function difficultyIconFilename(diff){
    if(!diff) return 'default.png';
    const name = String(diff).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'');
    return `${name}.png`;
  }

  // state
  let levels = [];
  let lvl = null;

  // fetch levels.json
  fetch('data/levels.json').then(r=>r.json()).then(data=>{
    levels = Array.isArray(data) ? data : [];
    levels.forEach((l,i)=> l.position = i+1);
    lvl = levels.find(x => String(x.id) === String(levelID));
    if(!lvl){
      if(container) container.innerHTML = "<p style='color:#f66'>Nivel no encontrado.</p>";
      return;
    }
    renderPage();
    // listen to localStorage changes to update records in real-time
    window.addEventListener('storage', (e) => {
      try{
        if(e.key === 'papan_records_last_update' || e.key === 'papan_records_overrides'){
          // update records only
          renderRecords();
        }
      }catch(err){ console.warn('storage event handler error', err); }
    });
  }).catch(err=>{
    console.error(err);
    if(container) container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
  });

  function getOverrideRecords(){
    try{
      const raw = localStorage.getItem('papan_records_overrides') || '{}';
      const obj = JSON.parse(raw);
      if(obj && Array.isArray(obj[lvl.id])) return obj[lvl.id].slice();
    }catch(e){}
    return [];
  }

  function combineRecords(){
    const base = Array.isArray(lvl.records) ? lvl.records.slice() : [];
    const overrides = getOverrideRecords();
    const combined = [];
    const seen = new Set();
    function pushRecord(r){
      const key = `${String(r.holder||'')}|${String(r.progress||'')}|${String(r.date||'')}`;
      if(seen.has(key)) return;
      seen.add(key);
      combined.push(r);
    }
    base.forEach(r=> pushRecord(r));
    overrides.forEach(r=> pushRecord(r));
    return combined;
  }

  function renderRecords(){
    const ul = document.getElementById('papanRecordsList');
    if(!ul) return;
    const combined = combineRecords();
    if(!combined.length){
      ul.innerHTML = "<li style='color:var(--muted)'>Sin records</li>";
      return;
    }
    ul.innerHTML = combined.map(r => {
      const enc = encodeURIComponent(r.holder);
      return `<li><a href="player.html?player=${enc}">${escapeHtml(r.holder)}</a> — ${escapeHtml(r.progress)} <span class="recdate">(${escapeHtml(r.date||'')})</span></li>`;
    }).join('');
  }

  function renderPage(){
    document.title = `${lvl.name} — PAPANATAS`;
    const thumb = `images/levels/${lvl.id}.png`;
    const tags = (lvl.tags || []).map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join(" ");
    const diffFilename = difficultyIconFilename(lvl.difficulty);
    const diffPath = `images/icons/${diffFilename}`;

    const html = `
      <div class="detail-wrap">

        <div class="detail-left">

          <img src="${thumb}" onerror="this.onerror=null;this.src='images/placeholder.png'">

          <div class="records-box">
            <strong>Records</strong>
            <ul id="papanRecordsList">
              <li style="color:var(--muted)">Cargando records...</li>
            </ul>
          </div>

        </div>

        <div class="detail-right">

          <div>

            <h2 id="levelTitle" style="display:flex;align-items:center;gap:10px">
              <span>${escapeHtml(lvl.name)}</span>
              <img src="${diffPath}" alt="${escapeHtml(lvl.difficulty || '')}" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display='none'">
            </h2>

            <div class="detail-meta">
              by ${escapeHtml(lvl.creator)} — Position #${escapeHtml(String(lvl.position || '-'))}
            </div>

            <div class="tag-row" style="margin-top:12px">
              <strong style="margin-right:8px;color:var(--muted);font-size:13px">Tags:</strong>
              ${tags || "<span style='color:var(--muted)'>-</span>"}
            </div>

          </div>

          <div class="info-block">

            <div class="info-row">
              <div><strong>GD ID:</strong></div>
              <div style="color:var(--muted)">${escapeHtml(lvl.gd_id || "-")}</div>
            </div>

            <div class="info-row">
              <div><strong>Duration:</strong></div>
              <div style="color:var(--muted)">${escapeHtml(lvl.duration || "-")}</div>
            </div>

            <div class="info-row">
              <div><strong>Objects:</strong></div>
              <div style="color:var(--muted)">${escapeHtml(String(lvl.objects || "-"))}</div>
            </div>

            <div class="info-row">
              <div><strong>Tier:</strong></div>
              <div style="color:var(--muted)">${escapeHtml(lvl.tier || "-")}</div>
            </div>

          </div>

        </div>

      </div>
    `;
    if(container) container.innerHTML = html;
    // now render records list synchronously from localStorage
    renderRecords();
  }

})();