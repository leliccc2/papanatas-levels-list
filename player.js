// player.js - perfil del jugador (bonito) + shows notifications from submissions (accepted/denied)
// includes Supabase sync for accepted records when available
(function(){
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

  // helper to get current session user
  function getCurrentUser(){ return sessionStorage.getItem('papan_current_user') || null; }

  // load base levels.json, then combine:
  fetch('data/levels.json').then(r=>r.json()).then(async (levels)=>{
    if(!Array.isArray(levels)){
      container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";
      return;
    }
    levels.forEach((lvl, idx) => lvl.position = idx + 1);

    // collect completed entries from levels.json (records array)
    const completed = [];
    levels.forEach(lvl => {
      if(Array.isArray(lvl.records)){
        for(const rec of lvl.records){
          if(String(rec.holder) === String(player) && String(rec.progress).trim() === "100%"){
            completed.push({ level: lvl, record: rec, source: 'json' });
            break;
          }
        }
      }
    });

    // accepted submissions from Supabase (if available)
    if(supabaseClient){
      try{
        const { data, error } = await supabaseClient
          .from('submissions')
          .select('level_id,level_name,player,progress,date')
          .eq('status', 'accepted')
          .eq('player', player);
        if(!error && Array.isArray(data)){
          for(const s of data){
            if(String(s.progress || '').trim() !== '100%') continue;
            const lid = String(s.level_id || '');
            const lvl = levels.find(x => String(x.id) === lid);
            if(lvl){
              // skip duplicates (already collected from JSON)
              const exists = completed.some(c => String(c.level.id) === String(lvl.id));
              if(!exists) completed.push({ level: lvl, record: { holder: player, progress: s.progress, date: s.date }, source: 'supabase' });
            } else {
              // level id not present in JSON -> ignore or show as placeholder
            }
          }
        }
      }catch(e){
        console.warn('Supabase player accepted fetch failed', e);
      }
    }

    // local overrides
    try{
      const overrides = JSON.parse(localStorage.getItem('papan_records_overrides') || '{}');
      for(const lid in overrides){
        const arr = overrides[lid] || [];
        for(const rec of arr){
          if(String(rec.holder) === String(player) && String(rec.progress).trim() === "100%"){
            const lvl = levels.find(x => String(x.id) === String(lid));
            if(lvl){
              const exists = completed.some(c => String(c.level.id) === String(lvl.id));
              if(!exists) completed.push({ level: lvl, record: rec, source: 'override' });
            }
          }
        }
      }
    }catch(e){ /* ignore */ }

    const total = completed.length;

    // determine "hardest" using difficulty_stars or difficulty name fallback
    let hardest = null;
    function starsValue(l){
      if(!l) return 0;
      if(l.difficulty_stars){
        const m = String(l.difficulty_stars).match(/(\d+)/);
        if(m) return parseInt(m[1],10);
      }
      // fallback: map common difficulty names to numbers
      const map = { trivial:1, easy:2, normal:3, harder:4, hard:5, insane:6, extreme:7 };
      const d = String(l.difficulty || '').toLowerCase();
      return map[d] || 0;
    }
    completed.forEach(c => {
      if(!hardest) hardest = c.level;
      else if(starsValue(c.level) > starsValue(hardest)) hardest = c.level;
    });

    document.title = player + " — PAPANATAS";

    const completedListHTML = completed.length
      ? completed.map(c => `<li><a href="level.html?id=${encodeURIComponent(c.level.id)}">${escapeHtml(c.level.name)}</a></li>`).join('')
      : '<li style="color:var(--muted)">No ha completado niveles</li>';

    // notifications: localStorage only (ui.js pushNotification writes here)
    let notificationsHtml = '';
    try{
      const key = `papan_notifications_${player}`;
      const notes = JSON.parse(localStorage.getItem(key) || '[]');
      if(notes && notes.length){
        notificationsHtml = `<div style="margin-top:12px"><div class="section-title">Notificaciones</div><ul style="margin-top:8px">` +
          notes.map(n => `<li>${escapeHtml(n.date)} — ${escapeHtml(n.text)}</li>`).join('') +
          `</ul>`;
        // Mark-as-read button only when viewing your own profile
        const current = getCurrentUser();
        if(current && String(current) === String(player)){
          notificationsHtml += `<div style="margin-top:8px"><button id="clearPlayerNotes" class="papan-muted">Marcar como leídas</button></div>`;
        }
        notificationsHtml += `</div>`;
      } else {
        notificationsHtml = `<div style="margin-top:12px"><div class="section-title">Notificaciones</div><div style="color:var(--muted);margin-top:8px">No hay notificaciones</div></div>`;
      }
    }catch(e){
      notificationsHtml = `<div style="margin-top:12px"><div class="section-title">Notificaciones</div><div style="color:var(--muted);margin-top:8px">No hay notificaciones</div></div>`;
    }

    container.innerHTML = `
      <div class="player-header">
        <h2 class="player-title">${escapeHtml(player)}</h2>
      </div>

      <div class="player-stats">
        <div class="stat"><div class="label">Niveles completados</div><div class="value">${total}</div></div>
        <div class="stat"><div class="label">Nivel más difícil completado</div><div class="value">${hardest ? `<a href="level.html?id=${encodeURIComponent(hardest.id)}">${escapeHtml(hardest.name)}</a>` : '<span style="color:var(--muted)">-</span>'}</div></div>
      </div>

      <div style="margin-top:18px">
        <div class="section-title">Lista de niveles completados</div>
        <div class="completed-list"><ul style="margin-top:8px">${completedListHTML}</ul></div>
      </div>

      ${notificationsHtml}
    `;

    // wire clear notifications button (only present if current user matches)
    const clearBtn = document.getElementById('clearPlayerNotes');
    if(clearBtn){
      clearBtn.addEventListener('click', ()=>{
        try{
          localStorage.removeItem(`papan_notifications_${player}`);
          alert('Notificaciones marcadas como leídas.');
          location.reload();
        }catch(e){}
      });
    }

  }).catch(err=>{
    console.error(err);
    if(container) container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
  });

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
})();