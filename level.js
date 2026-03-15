// level.js - muestra detalle de nivel + merges position_history + overrides, y añade icono de dificultad al título
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

  if(!Array.isArray(levels)){
    container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";
    return;
  }

  levels.forEach((lvl,i)=>lvl.position = i+1);

  const lvl = levels.find(x => x.id === levelID);

  if(!lvl){
    container.innerHTML = "<p style='color:#f66'>Nivel no encontrado.</p>";
    return;
  }

  // título de la página
  document.title = lvl.name;

  const thumb = `images/levels/${lvl.id}.png`;

  const tags = (lvl.tags || []).map(tag =>
    `<span class="tag-pill">${escapeHtml(tag)}</span>`
  ).join(" ");

  const records = (lvl.records || []).map(r => {

    const encoded = encodeURIComponent(r.holder);

    return `
      <li>
        <a href="player.html?player=${encoded}">${escapeHtml(r.holder)}</a>
        — ${escapeHtml(r.progress)}
        <span class="recdate">(${escapeHtml(r.date || "")})</span>
      </li>
    `;

  }).join("");

  // position history + overrides merging (we'll compute combined below)
  let combined = Array.isArray(lvl.position_history) ? lvl.position_history.slice() : [];

  try{
    // snapshot overrides sync (update local overrides history)
    const current = {};
    levels.forEach(l=> current[l.id] = l.position);
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
    localStorage.setItem('papan_positions_snapshot', JSON.stringify(current));
    localStorage.setItem(overridesKey, JSON.stringify(overrides));

    // merge overrides for this level if present
    if(overrides && Array.isArray(overrides[lvl.id])) combined = combined.concat(overrides[lvl.id]);
  }catch(e){
    // ignore errors
  }

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

  // difficulty icon path (sanitized)
  const diffFilename = difficultyIconFilename(lvl.difficulty);
  const diffPath = `images/icons/${diffFilename}`;

  // render
  container.innerHTML = `
  
  <div class="detail-wrap">

    <div class="detail-left">

      <img src="${thumb}" onerror="this.onerror=null;this.src='images/placeholder.png'">

      <div class="records-box">
        <strong>Records</strong>

        <ul>
          ${records || "<li style='color:var(--muted)'>Sin records</li>"}
        </ul>
      </div>

      <div class="records-box" style="margin-top:12px">
        <strong>Position History</strong>

        <ul>
          ${historyHtml || "<li style='color:var(--muted)'>Sin cambios aún</li>"}
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
          <strong style="margin-right:8px;color:var(--muted);font-size:13px">
            Tags:
          </strong>

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

      <div style="margin-top:6px" class="history-box">
        <strong>Position History</strong>
        ${historyHtml}
      </div>

    </div>

  </div>

  `;

})
.catch(err=>{
  console.error(err);
  container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
});

// helpers
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function difficultyIconFilename(diff){
  if(!diff) return 'default.png';
  const name = String(diff).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'');
  return `${name}.png`;
}

})();
