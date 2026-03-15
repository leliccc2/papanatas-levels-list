// level.js - muestra detalle de nivel + merges accepted record overrides from localStorage + difficulty icon
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

  // helpers
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function difficultyIconFilename(diff){
    if(!diff) return 'default.png';
    const name = String(diff).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'');
    return `${name}.png`;
  }

  // load levels.json and render the level
  fetch("data/levels.json")
  .then(r => r.json())
  .then(levels => {

    if(!Array.isArray(levels)){
      container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";
      return;
    }

    // assign positions
    levels.forEach((lvl,i)=>lvl.position = i+1);

    const lvl = levels.find(x => String(x.id) === String(levelID));

    if(!lvl){
      container.innerHTML = "<p style='color:#f66'>Nivel no encontrado.</p>";
      return;
    }

    document.title = `${lvl.name} — PAPANATAS`;

    const thumb = `images/levels/${lvl.id}.png`;

    // tags html
    const tags = (lvl.tags || []).map(tag =>
      `<span class="tag-pill">${escapeHtml(tag)}</span>`
    ).join(" ");

    // base records from JSON (clone)
    const baseRecords = Array.isArray(lvl.records) ? lvl.records.slice() : [];

    // Build initial page HTML, leaving a placeholder UL we can update later
    const diffFilename = difficultyIconFilename(lvl.difficulty);
    const diffPath = `images/icons/${diffFilename}`;

    container.innerHTML = `

    <div class="detail-wrap">

      <div class="detail-left">

        <img src="${thumb}" onerror="this.onerror=null;this.src='images/placeholder.png'">

        <div class="records-box">
          <strong>Records</strong>

          <ul id="papanRecordsList">
            ${renderRecordsHtml(baseRecords, [])}
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

      </div>

    </div>

    `;

    // After initial render, wire dynamic updating of the records list
    const recordsListNode = document.getElementById('papanRecordsList');

    // Refresh function: read overrides from localStorage, merge + dedupe and render
    function refreshRecords(){
      try{
        // load overrides
        let overrideRecords = [];
        try{
          const overrides = JSON.parse(localStorage.getItem('papan_records_overrides') || '{}');
          if(overrides && Array.isArray(overrides[lvl.id])) overrideRecords = overrides[lvl.id].slice();
        }catch(e){ /* ignore parsing errors */ }

        // combine and dedupe by holder+progress+date (keep JSON ones first)
        const combined = [];
        const seen = new Set();
        function pushRecord(r){
          const key = `${String(r.holder||'')}|${String(r.progress||'')}|${String(r.date||'')}`;
          if(seen.has(key)) return;
          seen.add(key);
          combined.push(r);
        }
        baseRecords.forEach(r=>pushRecord(r));
        overrideRecords.forEach(r=>pushRecord(r));

        // render into DOM
        if(recordsListNode){
          recordsListNode.innerHTML = renderRecordsHtml(combined, overrideRecords);
        }
      }catch(e){
        console.warn('Error actualizando records:', e);
      }
    }

    // initial refresh to include any overrides already present
    refreshRecords();

    // Listen to storage events so other tabs/windows (where admin accepted) trigger refresh here.
    window.addEventListener('storage', function(e){
      // refresh only when the relevant key changed or when localStorage cleared (e.key===null)
      if(e.key === 'papan_records_overrides' || e.key === null){
        refreshRecords();
      }
    });

    // Also refresh when window gains focus (helps if storage event didn't fire)
    window.addEventListener('focus', function(){
      refreshRecords();
    });

    // small helper to render records list as HTML; mark which ones came from overrides optionally
    function renderRecordsHtml(combinedRecords, overrideRecords){
      if(!combinedRecords || combinedRecords.length === 0){
        return "<li style='color:var(--muted)'>Sin records</li>";
      }
      // create a set of override signature keys for optional styling (not required)
      const overrideSet = new Set((overrideRecords || []).map(r => `${String(r.holder||'')}|${String(r.progress||'')}|${String(r.date||'')}`));
      return combinedRecords.map(r => {
        const isOverride = overrideSet.has(`${String(r.holder||'')}|${String(r.progress||'')}|${String(r.date||'')}`);
        const holderEnc = encodeURIComponent(r.holder);
        const datePart = r.date ? ` <span class="recdate">(${escapeHtml(r.date)})</span>` : '';
const badge = '';
        return `<li><a href="player.html?player=${holderEnc}">${escapeHtml(r.holder)}</a> — ${escapeHtml(r.progress)}${datePart}${badge}</li>`;
      }).join("");
    }

  })
  .catch(err=>{
    console.error(err);
    container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
  });

})();