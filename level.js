// level.js - muestra detalle de nivel + merges accepted record overrides from Supabase + local overrides + difficulty icon
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

// Supabase init
const supabaseUrl = 'https://hlvvxgljcrwjuelmascs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsdnZ4Z2xqY3J3anVlbG1hc2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTc0MjEsImV4cCI6MjA4OTE3MzQyMX0.r1bS2NeloY1EgtdlJH-ZqLyOzgIpoL2Y_qsRGQIOYiM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

fetch("data/levels.json")
.then(r => r.json())
.then(async levels => {

  if(!Array.isArray(levels)){
    container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";
    return;
  }

  levels.forEach((lvl,i)=>lvl.position = i+1);

  const lvl = levels.find(x => String(x.id) === String(levelID));
  if(!lvl){
    container.innerHTML = "<p style='color:#f66'>Nivel no encontrado.</p>";
    return;
  }

  document.title = `${lvl.name} — PAPANATAS`;

  const thumb = `images/levels/${lvl.id}.png`;
  const tags = (lvl.tags || []).map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join(" ");
  const baseRecords = Array.isArray(lvl.records) ? lvl.records.slice() : [];

  // fetch accepted submissions for this level from Supabase
  let remoteRecords = [];
  try{
    const { data, error } = await supabaseClient
      .from('submissions')
      .select('player,progress,date,status')
      .eq('status','accepted')
      .eq('level_id', lvl.id);
    if(!error && Array.isArray(data)) {
      remoteRecords = data.map(r => ({ holder: r.player, progress: r.progress, date: r.date }));
    }
  }catch(e){ console.warn('level.js supabase fetch error', e); }

  // local overrides (in case some were accepted locally)
  let overrideRecords = [];
  try{
    const overrides = JSON.parse(localStorage.getItem('papan_records_overrides') || '{}');
    if(overrides && Array.isArray(overrides[lvl.id])) overrideRecords = overrides[lvl.id].slice();
  }catch(e){ /* ignore */ }

  // combine and dedupe
  const combinedRecords = [];
  const seen = new Set();
  function pushRecord(r){
    const key = `${String(r.holder||'')}|${String(r.progress||'')}|${String(r.date||'')}`;
    if(seen.has(key)) return;
    seen.add(key);
    combinedRecords.push(r);
  }
  baseRecords.forEach(r=>pushRecord(r));
  remoteRecords.forEach(r=>pushRecord(r));
  overrideRecords.forEach(r=>pushRecord(r));

  const recordsHtml = combinedRecords.map(r => {
    const encoded = encodeURIComponent(r.holder);
    return `<li><a href="player.html?player=${encoded}">${escapeHtml(r.holder)}</a> — ${escapeHtml(r.progress)} <span class="recdate">(${escapeHtml(r.date||'')})</span></li>`;
  }).join("");

  const diffFilename = difficultyIconFilename(lvl.difficulty);
  const diffPath = `images/icons/${diffFilename}`;

  container.innerHTML = `

  <div class="detail-wrap">

    <div class="detail-left">

      <img src="${thumb}" onerror="this.onerror=null;this.src='images/placeholder.png'">

      <div class="records-box">
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

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

})();