// users.js - ranking by completed count (synchronized: JSON records + local overrides + Supabase accepted)
(async function(){
  'use strict';

  const container = document.getElementById('usersContent');

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

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function safeParse(s, fallback){ try{ return JSON.parse(s||'null'); }catch(e){ return fallback; } }

  // load levels.json
  async function loadLevels(){
    try{
      const r = await fetch('data/levels.json');
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }catch(e){
      console.error('loadLevels error', e);
      return [];
    }
  }

  // load local overrides
  function loadOverrides(){
    try{ const obj = JSON.parse(localStorage.getItem('papan_records_overrides') || '{}'); return (obj && typeof obj === 'object') ? obj : {}; }catch(e){ return {}; }
  }

  // compute completions map (player -> Set(levelId))
  async function computeCompletionsMap(levels){
    const map = new Map();
    function add(name, lid){
      if(!name) return;
      const k = String(name);
      if(!map.has(k)) map.set(k, new Set());
      map.get(k).add(String(lid));
    }

    levels.forEach(lvl=>{
      (lvl.records||[]).forEach(rec=>{
        if(String(rec.progress||'').trim() === '100%') add(rec.holder, lvl.id);
      });
    });

    // overrides
    const overrides = loadOverrides();
    for(const lid in overrides){
      const arr = Array.isArray(overrides[lid]) ? overrides[lid] : [];
      arr.forEach(r => { if(String(r.progress||'').trim() === '100%') add(r.holder, lid); });
    }

    // supabase accepted
    if(supabaseClient){
      try{
        const { data, error } = await supabaseClient
          .from('submissions')
          .select('player,level_id,progress,status')
          .eq('status','accepted');
        if(!error && Array.isArray(data)){
          data.forEach(s => { if(String(s.progress||'').trim() === '100%') add(s.player, s.level_id || s.levelId); });
        }
      }catch(e){ console.warn('users: supabase fetch error', e); }
    }

    return map;
  }

  // render ranking
  async function render(){
    container.innerHTML = 'Cargando...';
    const levels = await loadLevels();
    levels.forEach((lvl, idx)=> lvl.position = idx+1);

    const completionsMap = await computeCompletionsMap(levels);

    // transform map to array of users
    const users = Array.from(completionsMap.entries()).map(([name, set])=>{
      return { name, completedCount: set.size, completedLevels: Array.from(set) };
    });

    if(users.length === 0){
      container.innerHTML = "<p style='color:var(--muted)'>No hay usuarios todavía.</p>";
      return;
    }

    users.sort((a,b)=> b.completedCount - a.completedCount || a.name.localeCompare(b.name));

    const rows = users.map((u, idx) => {
      return `<div class="user-card" style="background:var(--card);padding:12px;border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;gap:12px;align-items:center">
          <div style="font-weight:900;color:var(--accent);font-size:18px">${idx+1}</div>
          <div>
            <a href="player.html?player=${encodeURIComponent(u.name)}" style="font-weight:800;color:var(--accent)">${escapeHtml(u.name)}</a>
            <div style="color:var(--muted);font-size:13px">${u.completedCount} completed</div>
          </div>
        </div>
        <div style="color:var(--muted);font-size:13px">${u.completedCount ? '' : ''}</div>
      </div>`;
    }).join('');

    container.innerHTML = `<h2 style="margin:0 0 12px">User ranking</h2><div>${rows}</div>`;
  }

  // initial
  render();

  // expose for console
  window.Papan = window.Papan || {};
  window.Papan.refreshUsers = render;

})();
