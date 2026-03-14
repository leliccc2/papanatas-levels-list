// packs.js - generates packs and makes them clickable to open a modal with stats
(function(){
  const container = document.getElementById('packsContent');

  fetch('data/levels.json').then(r=>r.json()).then(levels=>{
    if(!Array.isArray(levels)) return container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";

    // set positions
    levels.forEach((lvl, i)=> lvl.position = i+1);

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
        packs.push({ tag, levels: selected });
      }
    }

    if(packs.length === 0) return container.innerHTML = "<p style='color:var(--muted)'>No hay suficientes niveles para crear packs.</p>";

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
      const totalLevels = p.levels.length;
      const usersCompleted = [];
      for(const [name, setIds] of userMap.entries()){
        const ok = p.levels.every(l => setIds.has(l.id));
        if(ok) usersCompleted.push(name);
      }
      const percentCompleted = Math.round((usersCompleted.length / Math.max(1, userMap.size)) * 100);

      // pack card clickable -> data-index
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
        openPackModal(packs[idx], userMap);
      });
    });

  }).catch(err=>{
    console.error(err);
    container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>"
  });

  // open modal showing pack details
  function openPackModal(pack, userMap){
    const usersCompleted = [];
    for(const [name, setIds] of userMap.entries()){
      if(pack.levels.every(l => setIds.has(l.id))) usersCompleted.push(name);
    }
    const percentCompleted = Math.round((usersCompleted.length / Math.max(1, userMap.size)) * 100);

    const levelsList = pack.levels.map(l => `<li><a href="level.html?id=${encodeURIComponent(l.id)}">${escapeHtml(l.name)}</a> — #${escapeHtml(String(l.position||'-'))}</li>`).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <strong style="font-size:18px">${escapeHtml(pack.tag)} Pack</strong>
            <div style="color:var(--muted);font-size:13px">${pack.levels.length} niveles</div>
          </div>
          <div><button id="closeModal" style="padding:8px 10px;border-radius:8px;background:#111;border:1px solid rgba(255,255,255,0.04);color:var(--muted);">Cerrar</button></div>
        </div>
        <div class="modal-body">
          <div class="left">
            <div style="margin-top:8px">
              <strong>Levels in pack</strong>
              <ul style="margin-top:8px">${levelsList}</ul>
            </div>
          </div>
          <div class="right">
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