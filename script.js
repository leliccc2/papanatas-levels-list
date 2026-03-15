// script.js (index) - final con snapshot sync
let levels = [];
let filteredLevels = [];
let selectedTags = new Set();
let selectedTiers = new Set();

const levelsContainer = document.getElementById("levels-container");
const searchInput = document.getElementById("search");
const filterBtn = document.getElementById("filterBtn");
const filterPanel = document.getElementById("filterPanel");
const tagsContainer = document.getElementById("tagsContainer");
const tiersContainer = document.getElementById("tiersContainer");
const applyFiltersBtn = document.getElementById("applyFilters");
const clearFiltersBtn = document.getElementById("clearFilters");

// carga inicial
fetch("data/levels.json")
  .then(r => r.json())
  .then(data => {
    levels = Array.isArray(data) ? data : [];
    // asignar posiciones según orden
    levels.forEach((lvl, idx) => {
      lvl.position = idx + 1;
      if(!Array.isArray(lvl.records)) lvl.records = lvl.records || [];
      if(!Array.isArray(lvl.position_history)) lvl.position_history = lvl.position_history || [];
    });
    // sincronizar snapshot local y generar overrides si algo cambió
    syncPositionSnapshots(levels);
    buildFilterLists(levels);
    filteredLevels = levels.slice();
    renderLevels(filteredLevels);
  })
  .catch(err => {
    console.error("Error cargando levels.json:", err);
    levelsContainer.innerHTML = "<p style='color:#f66'>Error cargando niveles.</p>";
  });

/* ===== snapshot sync: detecta reordenamientos y guarda override history en localStorage ===== */
function syncPositionSnapshots(levelsArr){
  try{
    const current = {};
    levelsArr.forEach(l=> current[l.id] = l.position);
    const prevStr = localStorage.getItem('papan_positions_snapshot');
    const prev = prevStr ? JSON.parse(prevStr) : null;
    const overrides = JSON.parse(localStorage.getItem('papan_position_history_overrides') || '{}');
    const today = new Date().toISOString().slice(0,10);

    if(prev){
      for(const id in current){
        const oldPos = prev[id];
        const newPos = current[id];
        if(oldPos && oldPos !== newPos){
          if(!Array.isArray(overrides[id])) overrides[id] = [];
          const last = overrides[id][overrides[id].length - 1];
          if(!last || last.position !== newPos || last.date !== today){
            overrides[id].push({ position: newPos, date: today });
          }
        }
      }
    }
    // store current snapshot & overrides
    localStorage.setItem('papan_positions_snapshot', JSON.stringify(current));
    localStorage.setItem('papan_position_history_overrides', JSON.stringify(overrides));
  }catch(e){
    console.warn("No se pudo sync snapshots:", e);
  }
}
/* ===== end snapshot sync ===== */

function buildFilterLists(levelsArr){
  const tags = new Set();
  const tiers = new Set();
  levelsArr.forEach(l => {
    if (Array.isArray(l.tags)) l.tags.forEach(t => tags.add(t));
    if (l.tier) tiers.add(l.tier);
  });

  // tags
  tagsContainer.innerHTML = "";
  Array.from(tags).sort().forEach(tag => {
    const id = `tag_${slug(tag)}`;
    const el = document.createElement("label");
    el.className = "checkbox-item";
    el.innerHTML = `<input type="checkbox" data-type="tag" data-value="${escapeHtml(tag)}" id="${id}"> <span>${tag}</span>`;
    tagsContainer.appendChild(el);
  });

  // tiers
  tiersContainer.innerHTML = "";
  Array.from(tiers).sort().forEach(tier => {
    const id = `tier_${slug(tier)}`;
    const el = document.createElement("label");
    el.className = "checkbox-item";
    el.innerHTML = `<input type="checkbox" data-type="tier" data-value="${escapeHtml(tier)}" id="${id}"> <span>${tier}</span>`;
    tiersContainer.appendChild(el);
  });

  document.querySelectorAll('#tagsContainer input, #tiersContainer input').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const type = e.target.dataset.type;
      const val = e.target.dataset.value;
      if (type === 'tag') {
        if (e.target.checked) selectedTags.add(val); else selectedTags.delete(val);
      } else {
        if (e.target.checked) selectedTiers.add(val); else selectedTiers.delete(val);
      }
    });
  });
}

function renderLevels(levelsArr){
  levelsContainer.innerHTML = "";
  if (!levelsArr.length) {
    levelsContainer.innerHTML = "<p style='color:var(--muted)'>No hay niveles que coincidan.</p>";
    return;
  }

  // render all, inserting a LEGACY separator before position 75
  levelsArr.forEach((level) => {
    // insert separator before position 75
    if(level.position === 75){
      const sep = document.createElement("div");
      sep.className = "legacy-sep";
      sep.textContent = "LEGACY LIST (position ≥ 75)";
      levelsContainer.appendChild(sep);
    }

    const card = document.createElement("article");
    card.className = "level";

    const thumbSrc = `images/levels/${level.id}.png`;

    // compute difficulty icon path (sanitized difficulty -> filename)
    const diffFilename = difficultyIconFilename(level.difficulty);
    const diffPath = `images/icons/${diffFilename}`;

    card.innerHTML = `
      <div class="position">#${level.position}</div>

      <img class="thumb" src="${thumbSrc}" alt="${escapeHtml(level.name)}" onerror="this.onerror=null;this.src='images/placeholder.png'">

      <div class="level-info">
        <div class="level-top">
          <a class="level-link" href="level.html?id=${encodeURIComponent(level.id)}"><div class="level-title">${escapeHtml(level.name)}</div></a>
          <div class="level-creator">by ${escapeHtml(level.creator)}</div>
        </div>
      </div>

      <div class="card-right">
        ${isNew(level.date_added) ? '<div class="new-badge">NEW</div>' : ''}
        <img class="diff-icon" src="${diffPath}" alt="${escapeHtml(level.difficulty || '')}" style="width:36px;height:36px;margin-top:6px;margin-left:6px;object-fit:contain" onerror="this.style.display='none'">
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      window.location.href = `level.html?id=${encodeURIComponent(level.id)}`;
    });

    levelsContainer.appendChild(card);
  });
}

function isNew(dateStr){
  if(!dateStr) return false;
  const added = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diffH = (now - added) / (1000*60*60);
  return diffH < 48;
}

searchInput.addEventListener('input', () => applyFiltersAndSearch());
applyFiltersBtn?.addEventListener('click', () => { filterPanel.classList.add('hidden'); applyFiltersAndSearch(); });
clearFiltersBtn?.addEventListener('click', () => {
  document.querySelectorAll('#tagsContainer input, #tiersContainer input').forEach(cb => cb.checked = false);
  selectedTags.clear(); selectedTiers.clear();
  applyFiltersAndSearch();
});

filterBtn.addEventListener('click', () => {
  const hidden = filterPanel.classList.toggle('hidden');
  filterPanel.setAttribute('aria-hidden', hidden ? 'true' : 'false');
});

function applyFiltersAndSearch(){
  const q = (searchInput.value || "").trim().toLowerCase();

  filteredLevels = levels.filter(l => {
    const textMatch = !q || (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.creator && l.creator.toLowerCase().includes(q)) ||
      (l.gd_id && l.gd_id.toLowerCase().includes(q))
    );
    if(!textMatch) return false;

    if (selectedTags.size) {
      const lvlTags = new Set((l.tags || []).map(t => String(t)));
      for (let t of selectedTags) if (!lvlTags.has(t)) return false;
    }

    if (selectedTiers.size) {
      if (!l.tier || !selectedTiers.has(l.tier)) return false;
    }

    return true;
  });

  renderLevels(filteredLevels);
}

// helpers
function slug(s){ return String(s||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'') }
function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// sanitize difficulty and return filename (e.g. "harder" -> "harder.png")
function difficultyIconFilename(diff){
  if(!diff) return 'default.png';
  const name = String(diff).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'');
  return `${name}.png`;
}