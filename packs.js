// packs.js - packs synced with Supabase + local overrides + JSON records
// Regenerate button is shown ONLY to admins (localStorage 'papan_is_admin' === '1')
(async function(){
  'use strict';

  const container = document.getElementById('packsContent');
  const regenBtn = document.getElementById('regeneratePacks');

  // key used elsewhere in your UI
  const ISADMIN_KEY = 'papan_is_admin';
  const isAdmin = localStorage.getItem(ISADMIN_KEY) === '1';

  // If the page includes the regenerate button but the current client is not admin -> remove it from DOM
  if(regenBtn && !isAdmin){
    regenBtn.remove();
  }

  // Supabase init (optional)
  let supabaseClient = null;
  try {
    const supabaseUrl = 'https://hlvvxgljcrwjuelmascs.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsdnZ4Z2xqY3J3anVlbG1hc2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTc0MjEsImV4cCI6MjA4OTE3MzQyMX0.r1bS2NeloY1EgtdlJH-ZqLyOzgIpoL2Y_qsRGQIOYiM';
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
    } else {
      supabaseClient = null;
    }
  } catch(e){ supabaseClient = null; }

  // helpers
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function safeParse(s, fallback){ try{ return JSON.parse(s||'null'); }catch(e){ return fallback; } }
  function hashString(s){ let h = 2166136261 >>> 0; for(let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
  function mulberry32(a){ return function(){ var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } }
  function seededShuffle(array, seed){ let m = array.length, t, i; let random = mulberry32(seed); while (m) { i = Math.floor(random() * m--); t = array[m]; array[m] = array[i]; array[i] = t; } return array; }

  // read overrides from localStorage
  function loadOverrides(){
    try{
      const obj = JSON.parse(localStorage.getItem('papan_records_overrides') || '{}');
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(e){ return {}; }
  }

  // Compute players -> set(levelId) combining JSON records, overrides and Supabase accepted submissions
  async function computeCompletionsMap(levels){
    const map = new Map(); // player -> Set(levelId)

    function add(player, levelId){
      if(!player) return;
      const key = String(player);
      if(!map.has(key)) map.set(key, new Set());
      map.get(key).add(String(levelId));
    }

    // 1) JSON records
    levels.forEach(l => {
      (l.records||[]).forEach(r=>{
        if(String(r.progress||'').trim() === '100%'){
          add(r.holder, l.id);
        }
      });
    });

    // 2) local overrides
    try{
      const overrides = loadOverrides();
      for(const lid in overrides){
        const arr = Array.isArray(overrides[lid]) ? overrides[lid] : [];
        arr.forEach(r => {
          if(String(r.progress||'').trim() === '100%') add(r.holder, lid);
        });
      }
    }catch(e){ /* ignore */ }

    // 3) Supabase accepted submissions (if available)
    if(supabaseClient){
      try{
        const { data, error } = await supabaseClient
          .from('submissions')
          .select('player,level_id,progress,status')
          .eq('status','accepted');
        if(!error && Array.isArray(data)){
          data.forEach(s => {
            if(String(s.progress||'').trim() === '100%'){
              add(s.player, s.level_id || s.levelId);
            }
          });
        }
      }catch(e){
        console.warn('packs: supabase fetch error', e);
      }
    }

    return map;
  }

  // Compute packs deterministically from levels
  function computePacks(levels){
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
        const shuffled = seededShuffle(lvls.slice(), hashString(tag));
        const size = Math.min(8, Math.max(4, Math.floor((lvls.length + 3)/3)));
        const selected = shuffled.slice(0, Math.min(size, shuffled.length));
        packs.push({ tag, levelIds: selected.map(l=>l.id) });
      }
    }
    packs.sort((a,b)=> a.tag.localeCompare(b.tag));
    return packs;
  }

  // Render packs (packs is array of {tag, levelIds})
  function renderPacks(packs, levels, completionsMap){
    const levelById = new Map(levels.map(l=>[String(l.id), l]));
    if(!packs.length) { container.innerHTML = "<p style='color:var(--muted)'>No hay suficientes niveles para crear packs.</p>"; return; }

    // build userList from completionsMap keys
    const users = Array.from(completionsMap.keys());
    const totalUsers = users.length;

    const html = packs.map((p,i)=>{
      const packLevels = p.levelIds.map(id => levelById.get(String(id))).filter(Boolean);
      const totalLevels = p.levelIds.length;

      // compute usersCompleted: players who have every levelId in the pack
      const usersCompleted = [];
      completionsMap.forEach((set, name) => {
        const ok = p.levelIds.every(lid => set.has(String(lid)));
        if(ok) usersCompleted.push(name);
      });

      const percentCompleted = totalUsers === 0 ? 0 : Math.round((usersCompleted.length / Math.max(1, totalUsers)) * 100);
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

    container.innerHTML = html;

    // attach click listeners
    document.querySelectorAll('.pack-card').forEach(card=>{
      card.addEventListener('click', ()=>{
        const idx = Number(card.dataset.packIndex);
        openPackModal(packs[idx], levels, completionsMap);
      });
    });
  }

  function openPackModal(pack, levels, completionsMap){
    const levelById = new Map(levels.map(l=>[String(l.id), l]));
    const levelsList = pack.levelIds.map(id=>{
      const l = levelById.get(String(id));
      if(l) return `<li><a href="level.html?id=${encodeURIComponent(l.id)}">${escapeHtml(l.name)}</a> — #${escapeHtml(String(l.position||'-'))}</li>`;
      return `<li style="color:var(--muted)">[missing] ${escapeHtml(String(id))}</li>`;
    }).join('');

    const usersCompleted = [];
    completionsMap.forEach((set, name) => {
      if(pack.levelIds.every(lid => set.has(String(lid)))) usersCompleted.push(name);
    });

    const totalUsers = Math.max(1, Array.from(completionsMap.keys()).length);
    const percentCompleted = Math.round((usersCompleted.length / totalUsers) * 100);

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:99999';
    modal.innerHTML = `
      <div style="width:920px;max-width:96%;background:var(--card);padding:18px;border-radius:10px;border:1px solid rgba(255,255,255,0.03);color:var(--white)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong style="font-size:18px">${escapeHtml(pack.tag)} Pack</strong>
            <div style="color:var(--muted);font-size:13px">${pack.levelIds.length} niveles</div>
          </div>
          <div><button id="closeModal" style="padding:8px 10px;border-radius:8px;background:#111;border:1px solid rgba(255,255,255,0.04);color:var(--muted)">Cerrar</button></div>
        </div>
        <div style="display:flex;gap:16px;margin-top:12px">
          <div style="flex:1">
            <strong>Levels in pack</strong>
            <ul style="margin-top:8px">${levelsList}</ul>
          </div>
          <div style="width:300px">
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

  // main
  (async function run(){
    try{
      const resp = await fetch('data/levels.json');
      const levels = await resp.json();
      if(!Array.isArray(levels)){ container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>"; return; }
      levels.forEach((l,i)=> l.position = i+1);

      // try persisted packs in localStorage
      const STORAGE_KEY = 'papan_packs_v1';
      let persisted = null;
      try{ persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }catch(e){ persisted = null; }

      const packsToUse = (persisted && Array.isArray(persisted.packs) && persisted.packs.length) ? persisted.packs : computePacks(levels);

      // compute completions map (includes supabase and overrides)
      const completionsMap = await computeCompletionsMap(levels);

      renderPacks(packsToUse, levels, completionsMap);

      // regen button: only attach listener if the element exists AND user is admin.
      if(regenBtn && isAdmin){
        regenBtn.addEventListener('click', ()=>{
          if(!confirm('Regenerar packs hará que se reemplacen los packs guardados. ¿Continuar?')) return;
          const newPacks = computePacks(levels);
          try{
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ createdAt: new Date().toISOString(), packs: newPacks }));
            alert('Packs regenerados y guardados localmente.');
          }catch(e){ alert('Error guardando packs: '+(e && e.message)); }
          // re-render with fresh completions (recompute)
          (async ()=>{
            const map2 = await computeCompletionsMap(levels);
            renderPacks(newPacks, levels, map2);
          })();
        });
      }

    }catch(e){
      console.error('packs main error', e);
      container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
    }
  })();

})();
