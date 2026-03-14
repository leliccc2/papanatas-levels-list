(function(){

function qs(key){
  const p = new URLSearchParams(location.search);
  return p.get(key);
}

const levelID = qs("id");
const container = document.getElementById("levelContent");

if(!levelID){
  container.innerHTML = "<p style='color:var(--muted)'>Nivel no encontrado.</p>";
  return;
}

fetch("data/levels.json")
.then(r => r.json())
.then(levels => {

  levels.forEach((lvl,i)=>lvl.position = i+1);

  const lvl = levels.find(x => x.id === levelID);

  if(!lvl){
    container.innerHTML = "<p style='color:#f66'>Nivel no encontrado.</p>";
    return;
  }

  document.title = lvl.name;

  const thumb = `images/levels/${lvl.id}.png`;

  const tags = (lvl.tags || []).map(tag =>
    `<span class="tag-pill">${tag}</span>`
  ).join(" ");

  const records = (lvl.records || []).map(r => {

    const encoded = encodeURIComponent(r.holder);

    return `
      <li>
        <a href="player.html?player=${encoded}">${r.holder}</a>
        — ${r.progress}
        <span class="recdate">(${r.date || ""})</span>
      </li>
    `;

  }).join("");

  const history = (lvl.position_history || []).map(h => {

    return `<li>#${h.position} <span class="recdate">(${h.date})</span></li>`;

  }).join("");

  container.innerHTML = `
  
  <div class="detail-wrap">

    <div class="detail-left">

      <img src="${thumb}" onerror="this.src='images/placeholder.png'">

      <div class="records-box">
        <strong>Records</strong>

        <ul>
          ${records || "<li style='color:var(--muted)'>Sin records</li>"}
        </ul>
      </div>

      <div class="records-box" style="margin-top:12px">
        <strong>Position History</strong>

        <ul>
          ${history || "<li style='color:var(--muted)'>Sin cambios aún</li>"}
        </ul>
      </div>

    </div>


    <div class="detail-right">

      <div>

        <h2>${lvl.name}</h2>

        <div class="detail-meta">
          by ${lvl.creator} — Position #${lvl.position}
        </div>

        <div class="tag-row" style="margin-top:12px">
          <strong style="margin-right:8px;color:var(--muted);font-size:13px">
            Tags:
          </strong>

          ${tags}
        </div>

      </div>


      <div class="info-block">

        <div class="info-row">
          <div><strong>GD ID:</strong></div>
          <div style="color:var(--muted)">${lvl.gd_id || "-"}</div>
        </div>

        <div class="info-row">
          <div><strong>Duration:</strong></div>
          <div style="color:var(--muted)">${lvl.duration || "-"}</div>
        </div>

        <div class="info-row">
          <div><strong>Objects:</strong></div>
          <div style="color:var(--muted)">${lvl.objects || "-"}</div>
        </div>

        <div class="info-row">
          <div><strong>Tier:</strong></div>
          <div style="color:var(--muted)">${lvl.tier || "-"}</div>
        </div>

      </div>

    </div>

  </div>

  `;

})
.catch(err=>{
  console.error(err);
  container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
});

// level.js - merges levels.json position_history + local overrides and shows move direction
(function(){
  function qs(key){ const p = new URLSearchParams(location.search); return p.get(key) }
  const id = qs('id');
  const container = document.getElementById('levelContent');
  if(!id){
    container.innerHTML = "<p style='color:var(--muted)'>No se encontró id.</p>";
    return;
  }

  fetch('data/levels.json').then(r=>r.json()).then(levels=>{
    if(!Array.isArray(levels)){
      container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";
      return;
    }

    levels.forEach((lvl, idx) => lvl.position = idx + 1);

    // Update snapshot overrides in localStorage so reordering is tracked
    try{
      const current = {};
      levels.forEach(l=> current[l.id] = l.position);
      const prevStr = localStorage.getItem('papan_positions_snapshot');
      const prev = prevStr ? JSON.parse(prevStr) : null;
      const overrides = JSON.parse(localStorage.getItem('papan_position_history_overrides3') || '{}');
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
      localStorage.setItem('papan_positions_snapshot', JSON.stringify(current));
      localStorage.setItem('papan_position_history_overrides', JSON.stringify(overrides));
    }catch(e){ /* ignore */ }

    const lvl = levels.find(x => String(x.id) === String(id));
    if(!lvl){
      container.innerHTML = "<p style='color:#f66'>Nivel no encontrado.</p>";
      return;
    }

    document.title = lvl.name + " — PAPANATAS";

    const thumb = `images/levels/${lvl.id}.png`;
    const tagsHtml = (lvl.tags || []).map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join(' ');

    // records
    const recordsHtml = (lvl.records || []).map(r => {
      const encoded = encodeURIComponent(r.holder);
      return `<li><a href="player.html?player=${encoded}">${escapeHtml(r.holder)}</a> — ${escapeHtml(r.progress)} <span class="recdate">(${escapeHtml(r.date||'')})</span></li>`;
    }).join('');

    // combined position history
    let combined = Array.isArray(lvl.position_history) ? lvl.position_history.slice() : [];
    try{
      const overrides = JSON.parse(localStorage.getItem('papan_position_history_overrides') || '{}');
      if(overrides && Array.isArray(overrides[lvl.id])) combined = combined.concat(overrides[lvl.id]);
    }catch(e){ /* ignore */ }

    // dedupe by date+position and sort newest->oldest
    const seen = new Set();
    combined = combined.filter(item => {
      const key = `${item.date||''}|${item.position||''}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a,b)=>{
      const da = new Date(a.date||0), db = new Date(b.date||0);
      return db - da;
    });

    // build history html with move direction compared to the next (older)
    let historyHtml = '';
    if(combined.length){
      historyHtml = '<ul>';
      for(let i=0;i<combined.length;i++){
        const cur = combined[i];
        const next = combined[i+1]; // older entry
        let movementHtml = '';
        if(next){
          const curPos = Number(cur.position);
          const prevPos = Number(next.position);
          if(!isNaN(curPos) && !isNaN(prevPos) && curPos !== prevPos){
            const delta = Math.abs(prevPos - curPos);
            if(curPos < prevPos) movementHtml = `<span class="move-up">↑ Moved up ${delta}</span>`;
            else movementHtml = `<span class="move-down">↓ Moved down ${delta}</span>`;
          }
        } else {
          // compare to the live position
          const curPos = Number(cur.position);
          const livePos = Number(lvl.position || 0);
          if(!isNaN(curPos) && !isNaN(livePos) && curPos !== livePos){
            const delta = Math.abs(livePos - curPos);
            if(curPos < livePos) movementHtml = `<span class="move-up">↑ Moved up ${delta}</span>`;
            else movementHtml = `<span class="move-down">↓ Moved down ${delta}</span>`;
          }
        }

        historyHtml += `<li>Position #${escapeHtml(String(cur.position))} — <span class="recdate">${escapeHtml(cur.date||'')}</span> ${movementHtml}</li>`;
      }
      historyHtml += '</ul>';
    } else {
      historyHtml = '<div style="color:var(--muted)">No hay historial de posiciones</div>';
    }

    container.innerHTML = `
      <div class="detail-wrap" role="region" aria-labelledby="levelTitle">

        <div class="detail-left">
          <img src="${thumb}" alt="${escapeHtml(lvl.name)}" onerror="this.onerror=null;this.src='images/placeholder.png'">

          <div class="records-box" style="margin-top:12px">
            <strong>Records</strong>
            <ul>${recordsHtml || '<li style="color:var(--muted)">Sin records</li>'}</ul>
          </div>
        </div>

        <div class="detail-right">
          <div>
            <h2 id="levelTitle">${escapeHtml(lvl.name)}</h2>
            <div class="detail-meta">by ${escapeHtml(lvl.creator)} — Position #${escapeHtml(String(lvl.position || '-'))}</div>
            <div class="tag-row" style="margin-top:12px"><strong style="margin-right:8px;color:var(--muted);font-size:13px">Tags:</strong> ${tagsHtml || '<span style="color:var(--muted)">-</span>'}</div>
          </div>

          <div class="info-block" aria-hidden="false">
            <div class="info-row"><div><strong>GD ID:</strong></div><div style="color:var(--muted)">${escapeHtml(lvl.gd_id || '-')}</div></div>
            <div class="info-row"><div><strong>Duration:</strong></div><div style="color:var(--muted)">${escapeHtml(lvl.duration || '-')}</div></div>
            <div class="info-row"><div><strong>Objects:</strong></div><div style="color:var(--muted)">${escapeHtml(String(lvl.objects || '-'))}</div></div>
            <div class="info-row"><div><strong>Tier:</strong></div><div style="color:var(--muted)">${escapeHtml(lvl.tier || '-')}</div></div>
          </div>

          <div style="margin-top:6px" class="history-box">
            <strong>Position History</strong>
            ${historyHtml}
          </div>

        </div>
      </div>
    `;
  }).catch(err=>{
    console.error(err);
    container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>"
  });

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
})();
})();