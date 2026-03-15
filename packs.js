// packs.js - generates packs once and persist them in localStorage or Supabase so they do not change on levels.json edits
(function(){
  const container = document.getElementById('packsContent');
  const regenBtn = document.getElementById('regeneratePacks');

  const STORAGE_KEY = 'papan_packs_v1';
  const SUPABASE_URL = 'https://hlvvxgljcrwjuelmascs.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsdnZ4Z2xqY3J3anVlbG1hc2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTc0MjEsImV4cCI6MjA4OTE3MzQyMX0.r1bS2NeloY1EgtdlJH-ZqLyOzgIpoL2Y_qsRGQIOYiM';

  // detect admin from localStorage (same mechanism UI uses)
  const isAdmin = localStorage.getItem("papan_is_admin") === "1";
  if(regenBtn && !isAdmin){
    // remove regen button for non-admins (keeps DOM clean)
    regenBtn.remove();
  }

  // create supabase client (if library present)
  let supabaseClient = null;
  try{
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    } else {
      // create our own instance (safe even if ui.js also created one)
      if(window.supabase && typeof window.supabase.createClient !== 'function'){
        supabaseClient = null;
      } else if(typeof window.supabase !== 'undefined' && window.supabase.createClient){
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      } else {
        // try to reference global supabase variable anyway (in case library loaded)
        try { supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON); } catch(e){ supabaseClient = null; }
      }
    }
  }catch(e){
    supabaseClient = null;
  }

  // Entry: load levels, then load packs (remote/local/generate)
  fetch('data/levels.json').then(r=>r.json()).then(async (levels)=>{
    if(!Array.isArray(levels)) {
      if(container) container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";
      return;
    }

    // set positions
    levels.forEach((lvl,i)=> lvl.position = i+1);

    // try remote packs first (if supabase available)
    let packs = null;
    let remoteRow = null;
    if(supabaseClient){
      try{
        // attempt to fetch the latest packs row
        const { data, error } = await supabaseClient
          .from('packs')
          .select('id,packs,created_at,created_by')
          .order('created_at', { ascending: false })
          .limit(1);
        if(error){
          console.warn('Supabase: could not read packs table (fallback to local):', error);
        } else if(Array.isArray(data) && data.length){
          remoteRow = data[0];
          // packs may be stored as JSON array in column 'packs'
          if(remoteRow && (Array.isArray(remoteRow.packs) || typeof remoteRow.packs === 'string')){
            packs = Array.isArray(remoteRow.packs) ? remoteRow.packs : (JSON.parse(remoteRow.packs || '[]'));
          }
        }
      }catch(e){
        console.warn('Supabase packs load failed (fallback to local):', e);
        packs = null;
      }
    }

    // if no remote packs, try localStorage persisted packs
    if(!packs){
      try{
        const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if(persisted && Array.isArray(persisted.packs) && persisted.packs.length){
          packs = persisted.packs;
        }
      }catch(e){
        packs = null;
      }
    }

    // if still no packs, compute and persist locally (and optionally remotely if admin)
    if(!packs || !packs.length){
      packs = computePacks(levels);
      // persist locally
      try{
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ createdAt: new Date().toISOString(), packs }));
      }catch(e){ console.warn('Could not write packs locally:', e); }

      // if supabase available and admin, try to insert remote row
      if(supabaseClient && isAdmin){
        try{
          const { data: inserted, error: insertErr } = await supabaseClient
            .from('packs')
            .insert([{ packs }])
            .select();
          if(insertErr) console.warn('Supabase: failed to insert generated packs (ignored):', insertErr);
          else remoteRow = Array.isArray(inserted) ? inserted[0] : inserted;
        }catch(e){ console.warn('Supabase insert packs failed:', e); }
      }
    }

    // finally render
    renderPacksFromPersisted(packs, levels);

    // attach regenerate button handler (only if regenBtn exists)
    if(regenBtn){
      regenBtn.addEventListener('click', async ()=>{
        if(!confirm('Regenerar packs hará que se reemplacen los packs guardados. ¿Continuar?')) return;
        const newPacks = computePacks(levels, /*forceNew*/ true);
        // update local
        try{
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ createdAt: new Date().toISOString(), packs: newPacks }));
        }catch(e){ console.warn('Could not persist packs locally:', e); }
        // if supabase available and admin, update remote row (update latest row if exists, otherwise insert)
        if(supabaseClient && isAdmin){
          try{
            if(remoteRow && remoteRow.id){
              const { data: upd, error: errUpd } = await supabaseClient
                .from('packs')
                .update({ packs: newPacks, created_at: new Date().toISOString() })
                .eq('id', remoteRow.id)
                .select();
              if(errUpd){
                // fallback: insert new row
                const { data: ins2, error: errIns2 } = await supabaseClient
                  .from('packs')
                  .insert([{ packs }])
                  .select();
                if(errIns2) console.warn('Supabase update/insert failed:', errIns2);
                else remoteRow = Array.isArray(ins2) ? ins2[0] : ins2;
              } else {
                remoteRow = Array.isArray(upd) ? upd[0] : upd;
              }
            } else {
              const { data: ins, error: errIns } = await supabaseClient
                .from('packs')
                .insert([{ packs }])
                .select();
              if(errIns) console.warn('Supabase insert failed:', errIns);
              else remoteRow = Array.isArray(ins) ? ins[0] : ins;
            }
            alert('Packs regenerados y guardados (remote/local).');
          }catch(e){
            console.warn('Supabase regen failed, but local persisted:', e);
            alert('Packs regenerados localmente (no se pudo actualizar remote).');
          }
        } else {
          alert('Packs regenerados y guardados localmente.');
        }
        renderPacksFromPersisted(newPacks, levels);
      });
    }

  }).catch(err=>{
    console.error('Error cargando levels.json:', err);
    if(container) container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>"
  });

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

  // Render packs (same UI as before)
  function renderPacksFromPersisted(packs, levels){
    const levelById = new Map(levels.map(l => [String(l.id), l]));

    if(!packs.length){
      if(container) container.innerHTML = "<p style='color:var(--muted)'>No hay suficientes niveles para crear packs.</p>";
      return;
    }

    // compute user completions map from levels' records (local JSON)
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

    if(container) container.innerHTML = packsHtml;

    document.querySelectorAll('.pack-card').forEach(card=>{
      card.addEventListener('click', (e)=>{
        const idx = Number(card.dataset.packIndex);
        openPackModal(packs[idx], userMap, levelById);
      });
    });
  }

  // open modal showing pack details
  function openPackModal(pack, userMap, levelById){
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