// packs.js - generates packs once and persist them in localStorage so they do not change on levels.json edits
(function(){
  const container = document.getElementById('packsContent');
  const regenBtn = document.getElementById('regeneratePacks');

  // key for persisted packs
  const STORAGE_KEY = 'papan_packs_v1';

  fetch('data/levels.json').then(r=>r.json()).then(levels=>{
    if(!Array.isArray(levels)) return container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";

    // set positions locally
    levels.forEach((lvl, i)=> lvl.position = i+1);

    // get persisted packs if present
    let persisted = null;
    try { persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch(e) { persisted = null; }

    if(persisted && Array.isArray(persisted.packs) && persisted.packs.length){
      // Use persisted packs: they contain tag + levelIds
      renderPacksFromPersisted(persisted.packs, levels);
    } else {
      // No persisted packs -> generate and persist
      const packs = computePacks(levels);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ createdAt: new Date().toISOString(), packs }));
      } catch(e){ console.warn('No se pudo persistir packs:', e); }
      renderPacksFromPersisted(packs, levels);
    }

    // attach regenerate button
    if(regenBtn){
      regenBtn.addEventListener('click', ()=>{
        if(!confirm('Regenerar packs hará que se reemplacen los packs guardados. ¿Continuar?')) return;
        const newPacks = computePacks(levels, /*forceNew*/ true);
        try{
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ createdAt: new Date().toISOString(), packs: newPacks }));
          alert('Packs regenerados y guardados localmente.');
        }catch(e){ alert('Error guardando packs: '+(e && e.message)); }
        renderPacksFromPersisted(newPacks, levels);
      });
    }

  }).catch(err=>{
    console.error(err);
    container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>"
  });

  // Compute packs deterministically from levels (used only on first-run or when user regenerates)
  function computePacks(levels){
    // tag -> list of levels
    const tagMap = new Map();
    levels.forEach(lvl => {
      (lvl.tags||[]).forEach(t => {
        if(!tagMap.has(t)) tagMap.set(t, []);
        tagMap.get(t).push(lvl);
      });
    });

    const packs = [];
    for(const [tag, lvls] of tagMap.entries()){
      if(lvls.length >= 4){
        // choose up to 8 levels deterministically
        const shuffled = seededShuffle(lvls.slice(), hashString(tag));
        const size = Math.min(8, Math.max(4, Math.floor((lvls.length + 3)/3)));
        const selected = shuffled.slice(0, Math.min(size, shuffled.length));
        packs.push({ tag, levelIds: selected.map(l=>l.id) });
      }
    }

    // sort packs by tag for stable ordering
    packs.sort((a,b)=> a.tag.localeCompare(b.tag));
    return packs;
  }

  // Render using persisted packs (which store level ids) but show up-to-date info (name, pos)
  function renderPacksFromPersisted(packs, levels){
    const levelById = new Map(levels.map(l => [String(l.id), l]));

    if(!packs.length) return container.innerHTML = "<p style='color:var(--muted)'>No hay suficientes niveles para crear packs.</p>";

    // compute user completions map
    const userMap = new Map();
    levels.forEach(lvl => {
      (lvl.records||[]).forEach(rec=>{
        if(String(rec.progress||'').trim() === "100%"){
          if(!userMap.has(rec.holder)) userMap.set(rec.holder, new Set());
          userMap.get(rec.holder).add(lvl.id);
        }
      });
    });

    const packsHtml = packs.map((p, i) => {
      const packLevels = p.levelIds.map(id => levelById.get(String(id))).filter(Boolean);
      const totalLevels = p.levelIds.length;
      const usersCompleted = [];
      for(const [name, setIds] of userMap.entries()){
        const ok = p.levelIds.every(lid => setIds.has(lid));
        if(ok) usersCompleted.push(name);
      }
      const percentCompleted = Math.round((usersCompleted.length / Math.max(1, userMap.size)) * 100);

      return `<div class="pack-card" data-pack-index="${i}" style="background:var(--card);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.02);margin-bottom:12px;cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong style="font-size:16px">${escapeHtml(p.tag)} Pack</strong>
            <div style="color:var(--muted);font-size:13px">${totalLevels} niveles</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800">${usersCompleted.length} completed</div>
            <div style="color:var(--muted);font-size:12px">${percentCompleted}% of users</div>
          </div>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = packsHtml;

    // add click listeners to pack cards
    document.querySelectorAll('.pack-card').forEach(card=>{
      card.addEventListener('click', (e)=>{
        const idx = Number(card.dataset.packIndex);
        openPackModal(packs[idx], userMap, levelById);
      });
    });
  }

  // open modal showing pack details (resolve stored ids to current level objects if possible)
  function openPackModal(pack, userMap, levelById){
    const levelsResolved = pack.levelIds.map(id => levelById.get(String(id))).filter(Boolean);
    // if a stored id is missing, show as placeholder entry
    const levelsList = pack.levelIds.map(id => {
      const l = levelById.get(String(id));
      if(l) return `<li><a href="level.html?id=${encodeURIComponent(l.id)}">${escapeHtml(l.name)}</a> — #${escapeHtml(String(l.position||'-'))}</li>`;
      return `<li style="color:var(--muted)">[missing] ${escapeHtml(String(id))}</li>`;
    }).join('');

    const usersCompleted = [];
    for(const [name, setIds] of userMap.entries()){
      if(pack.levelIds.every(lid => setIds.has(lid))) usersCompleted.push(name);
    }
    const percentCompleted = Math.round((usersCompleted.length / Math.max(1, userMap.size)) * 100);

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong style="font-size:18px">${escapeHtml(pack.tag)} Pack</strong>
            <div style="color:var(--muted);font-size:13px">${pack.levelIds.length} niveles</div>
          </div>
          <div><button id="closeModal" style="padding:8px 10px;border-radius:8px;background:#111;border:1px solid rgba(255,255,255,0.04);color:var(--muted);">Cerrar</button></div>
        </div>
        <div class="modal-body" style="display:flex;gap:16px;margin-top:12px">
          <div class="left" style="flex:1">
            <div style="margin-top:8px">
              <strong>Levels in pack</strong>
              <ul style="margin-top:8px">${levelsList}</ul>
            </div>
          </div>
          <div class="right" style="width:300px">
            <div style="background:var(--card);padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.02)">
              <div style="font-weight:800;font-size:16px">${usersCompleted.length} users</div>
              <div style="color:var(--muted);font-size:13px">${percentCompleted}% of users completed this pack</div>
              <div style="margin-top:12px">
                <strong>Users completed</strong>
                <ul style="margin-top:8px">${usersCompleted.length ? usersCompleted.map(u=>`<li><a href="player.html?player=${encodeURIComponent(u)}">${escapeHtml(u)}</a></li>`).join('') : '<li style="color:var(--muted)">Nadie aún</li>'}</ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#closeModal').addEventListener('click', ()=> modal.remove());
    modal.addEventListener('click', (e)=> { if(e.target === modal) modal.remove(); });
  }

  // helpers
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function hashString(s){ let h = 2166136261 >>> 0; for(let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
  function seededShuffle(array, seed){ let m = array.length, t, i; let random = mulberry32(seed); while (m) { i = Math.floor(random() * m--); t = array[m]; array[m] = array[i]; array[i] = t; } return array; }
  function mulberry32(a) { return function() { var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } }

})();