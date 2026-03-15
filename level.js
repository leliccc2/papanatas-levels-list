// level.js - detalle de nivel (sin mostrar Position History) + sincronización snapshot/overrides + icono de dificultad
(function(){
  'use strict';

  function qs(key){ const p = new URLSearchParams(location.search); return p.get(key); }

  const levelID = qs('id');
  const container = document.getElementById('levelContent');

  if(!container){
    console.error('levelContent element not found');
    // nothing else we can do
    return;
  }

  if(!levelID){
    container.innerHTML = "<p style='color:var(--muted)'>Nivel no encontrado.</p>";
    return;
  }

  // main fetch + render
  fetch('data/levels.json')
    .then(res => {
      if(!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(levels => {
      if(!Array.isArray(levels)){
        container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";
        return;
      }

      // Normalize levels, assign positions and ensure arrays exist
      levels.forEach((lvl, idx) => {
        lvl.position = idx + 1;
        if(!Array.isArray(lvl.records)) lvl.records = lvl.records || [];
        if(!Array.isArray(lvl.position_history)) lvl.position_history = lvl.position_history || [];
      });

      // Update snapshot overrides in localStorage so reordering is tracked.
      // We keep this logic to avoid breaking the rest of the app, but we won't render history UI.
      try{
        const current = {};
        levels.forEach(l => current[l.id] = l.position);

        const prevStr = localStorage.getItem('papan_positions_snapshot');
        const prev = prevStr ? JSON.parse(prevStr) : null;

        const overridesKey = 'papan_position_history_overrides';
        const overrides = JSON.parse(localStorage.getItem(overridesKey) || '{}');

        const today = new Date().toISOString().slice(0,10);

        if(prev){
          for(const lid in current){
            const oldPos = prev[lid];
            const newPos = current[lid];
            if(oldPos && oldPos !== newPos){
              if(!Array.isArray(overrides[lid])) overrides[lid] = [];
              const last = overrides[lid][overrides[lid].length - 1];
              if(!last || last.position !== newPos || last.date !== today){
                overrides[lid].push({ position: newPos, date: today });
              }
            }
          }
        }

        // persist snapshot + overrides back to localStorage
        localStorage.setItem('papan_positions_snapshot', JSON.stringify(current));
        localStorage.setItem(overridesKey, JSON.stringify(overrides));
      }catch(e){
        // non fatal — don't block rendering
        console.warn('Error syncing position snapshots/overrides:', e);
      }

      // find requested level
      const lvl = levels.find(x => String(x.id) === String(levelID));
      if(!lvl){
        container.innerHTML = "<p style='color:#f66'>Nivel no encontrado.</p>";
        return;
      }

      // set document title
      document.title = `${lvl.name} — PAPANATAS`;

      const thumb = `images/levels/${lvl.id}.png`;

      // render tags
      const tagsHtml = (lvl.tags || []).map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join(' ');

      // render records (if any)
      const recordsHtml = (lvl.records || []).map(r => {
        const encoded = encodeURIComponent(r.holder || '');
        return `<li><a href="player.html?player=${encoded}">${escapeHtml(r.holder || '')}</a> — ${escapeHtml(r.progress || '')} <span class="recdate">(${escapeHtml(r.date||'')})</span></li>`;
      }).join('');

      // difficulty icon path
      const diffFilename = difficultyIconFilename(lvl.difficulty);
      const diffPath = `images/icons/${diffFilename}`;

      // Build final HTML (no position history sections anywhere)
      container.innerHTML = `
        <div class="detail-wrap" role="region" aria-labelledby="levelTitle">

          <div class="detail-left">
            <img src="${thumb}" alt="${escapeHtml(lvl.name)}" onerror="this.onerror=null;this.src='images/placeholder.png'">

            <div class="records-box" style="margin-top:12px">
              <strong>Records</strong>
              <ul>
                ${recordsHtml || "<li style='color:var(--muted)'>Sin records</li>"}
              </ul>
            </div>
          </div>

          <div class="detail-right">
            <div>
              <h2 id="levelTitle" style="display:flex;align-items:center;gap:10px">
                <span>${escapeHtml(lvl.name)}</span>
                <img src="${diffPath}" alt="${escapeHtml(lvl.difficulty || '')}" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display='none'">
              </h2>

              <div class="detail-meta">by ${escapeHtml(lvl.creator)} — Position #${escapeHtml(String(lvl.position || '-'))}</div>

              <div class="tag-row" style="margin-top:12px">
                <strong style="margin-right:8px;color:var(--muted);font-size:13px">Tags:</strong>
                ${tagsHtml || "<span style='color:var(--muted)'>-</span>"}
              </div>
            </div>

            <div class="info-block" aria-hidden="false" style="margin-top:12px">
              <div class="info-row"><div><strong>GD ID:</strong></div><div style="color:var(--muted)">${escapeHtml(lvl.gd_id || '-')}</div></div>
              <div class="info-row"><div><strong>Duration:</strong></div><div style="color:var(--muted)">${escapeHtml(lvl.duration || '-')}</div></div>
              <div class="info-row"><div><strong>Objects:</strong></div><div style="color:var(--muted)">${escapeHtml(String(lvl.objects || '-'))}</div></div>
              <div class="info-row"><div><strong>Tier:</strong></div><div style="color:var(--muted)">${escapeHtml(lvl.tier || '-')}</div></div>
            </div>

          </div>

        </div>
      `;
    })
    .catch(err => {
      console.error('Error cargando levels.json:', err);
      container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
    });

  // helpers
  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // Map difficulty string to sanitized filename: "High CPS" -> "high-cps.png"
  function difficultyIconFilename(diff){
    if(!diff) return 'default.png';
    const name = String(diff).toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'');
    return `${name}.png`;
  }

})();