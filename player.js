// player.js - perfil del jugador (bonito) + shows notifications from submissions (accepted/denied)
// includes Supabase sync for accepted records when available
(async function(){
  'use strict';

  function qs(k){ return new URLSearchParams(location.search).get(k) }
  const player = qs('player');
  const container = document.getElementById('playerContent');
  if(!player){ if(container) container.innerHTML = "<p style='color:var(--muted)'>No se indicó jugador.</p>"; return; }

  // Supabase init (optional)
  let supabaseClient = null;
  try{
    const supabaseUrl = 'https://hlvvxgljcrwjuelmascs.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsdnZ4Z2xqY3J3anVlbG1hc2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTc0MjEsImV4cCI6MjA4OTE3MzQyMX0.r1bS2NeloY1EgtdlJH-ZqLyOzgIpoL2Y_qsRGQIOYiM';
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
    } else {
      supabaseClient = null;
    }
  }catch(e){ supabaseClient = null; }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function safeParse(s, fallback){ try{ return JSON.parse(s||'null'); }catch(e){ return fallback; } }

  // load levels
  async function loadLevels(){
    try{
      const r = await fetch('data/levels.json');
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }catch(e){
      return [];
    }
  }

  // load overrides
  function loadOverrides(){ try{ const o = JSON.parse(localStorage.getItem('papan_records_overrides') || '{}'); return (o && typeof o === 'object') ? o : {}; }catch(e){ return {}; } }

  // compute completions map (same logic used in packs/users)
  async function computeCompletionsMap(levels){
    const map = new Map();
    function add(name, lid){
      if(!name) return;
      const k = String(name);
      if(!map.has(k)) map.set(k, new Set());
      map.get(k).add(String(lid));
    }

    levels.forEach(l=>{
      (l.records||[]).forEach(r=>{
        if(String(r.progress||'').trim() === '100%') add(r.holder, l.id);
      });
    });

    const overrides = loadOverrides();
    for(const lid in overrides){
      const arr = Array.isArray(overrides[lid]) ? overrides[lid] : [];
      arr.forEach(r => { if(String(r.progress||'').trim() === '100%') add(r.holder, lid); });
    }

    if(supabaseClient){
      try{
        const { data, error } = await supabaseClient
          .from('submissions')
          .select('player,level_id,progress,status')
          .eq('status','accepted');
        if(!error && Array.isArray(data)){
          data.forEach(s => { if(String(s.progress||'').trim() === '100%') add(s.player, s.level_id || s.levelId); });
        }
      }catch(e){ console.warn('player: supabase fetch error', e); }
    }
    return map;
  }

  // render player view using completions map
  (async function render(){
    try{
      const levels = await loadLevels();
      if(!levels.length){ if(container) container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>"; return; }
      levels.forEach((l,i)=> l.position = i+1);

      const completionsMap = await computeCompletionsMap(levels);

      const set = completionsMap.get(String(player)) || new Set();
      const completedLevels = Array.from(set).map(lid => levels.find(x => String(x.id) === String(lid))).filter(Boolean);

      const total = completedLevels.length;

      // hardest
      function starsValue(l){
        if(!l) return 0;
        if(l.difficulty_stars){
          const m = String(l.difficulty_stars).match(/(\d+)/);
          if(m) return parseInt(m[1],10);
        }
        const map = { trivial:1, easy:2, normal:3, harder:4, hard:5, insane:6, extreme:7 };
        const d = String(l.difficulty || '').toLowerCase();
        return map[d] || 0;
      }
      let hardest = null;
      completedLevels.forEach(l => {
        if(!hardest) hardest = l;
        else if(starsValue(l) > starsValue(hardest)) hardest = l;
      });

      // notifications (localStorage)
      let notificationsHtml = '';
      try{
        const key = `papan_notifications_${player}`;
        const notes = JSON.parse(localStorage.getItem(key) || '[]');
        if(notes && notes.length){
          notificationsHtml = `<div style="margin-top:12px"><div class="section-title">Notificaciones</div><ul style="margin-top:8px">` +
            notes.map(n => `<li>${escapeHtml(n.date)} — ${escapeHtml(n.text)}</li>`).join('') +
            `</ul>`;
          const current = sessionStorage.getItem('papan_current_user') || null;
          if(current && String(current) === String(player)){
            notificationsHtml += `<div style="margin-top:8px"><button id="clearPlayerNotes" class="papan-muted">Marcar como leídas</button></div>`;
          }
          notificationsHtml += `</div>`;
        } else {
          notificationsHtml = `<div style="margin-top:12px"><div class="section-title">Notificaciones</div><div style="color:var(--muted);margin-top:8px">No hay notificaciones</div></div>`;
        }
      }catch(e){ notificationsHtml = `<div style="margin-top:12px"><div class="section-title">Notificaciones</div><div style="color:var(--muted);margin-top:8px">No hay notificaciones</div></div>`; }

      const completedListHTML = total ? completedLevels.map(l => `<li><a href="level.html?id=${encodeURIComponent(l.id)}">${escapeHtml(l.name)}</a></li>`).join('') : '<li style="color:var(--muted)">No ha completado niveles</li>';

      document.title = player + " — PAPANATAS";
      if(container){
        container.innerHTML = `
          <div class="player-header">
            <h2 class="player-title">${escapeHtml(player)}</h2>
          </div>

          <div class="player-stats" style="display:flex;gap:18px;flex-wrap:wrap">
            <div class="stat"><div class="label">Niveles completados</div><div class="value">${total}</div></div>
            <div class="stat"><div class="label">Nivel más difícil completado</div><div class="value">${hardest ? `<a href="level.html?id=${encodeURIComponent(hardest.id)}">${escapeHtml(hardest.name)}</a>` : '<span style="color:var(--muted)">-</span>'}</div></div>
          </div>

          <div style="margin-top:18px">
            <div class="section-title">Lista de niveles completados</div>
            <div class="completed-list"><ul style="margin-top:8px">${completedListHTML}</ul></div>
          </div>

          ${notificationsHtml}
        `;
      }

      const clearBtn = document.getElementById('clearPlayerNotes');
      if(clearBtn){
        clearBtn.addEventListener('click', ()=>{
          try{ localStorage.removeItem(`papan_notifications_${player}`); alert('Notificaciones marcadas como leídas.'); location.reload(); }catch(e){}
        });
      }

    }catch(e){
      console.error('player render error', e);
      if(container) container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
    }
  })();

})();
