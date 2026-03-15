// users.js - ranking by completed count using Supabase if available, otherwise fallback to local overrides
(function(){
  const container = document.getElementById('usersContent');
  if(!container) return;

  const supabaseUrl = 'https://hlvvxgljcrwjuelmascs.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsdnZ4Z2xqY3J3anVlbG1hc2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTc0MjEsImV4cCI6MjA4OTE3MzQyMX0.r1bS2NeloY1EgtdlJH-ZqLyOzgIpoL2Y_qsRGQIOYiM';

  let supabaseClient = null;
  if(window.supabase && typeof window.supabase.createClient === 'function'){
    try { supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey); } catch(e){ supabaseClient = null; console.warn('Supabase client init failed', e); }
  } else {
    console.warn('Supabase lib not present - users ranking will use local overrides only.');
  }

  container.innerHTML = 'Cargando...';

  (async function build(){
    try{
      const levelsResp = await fetch('data/levels.json');
      const levels = await levelsResp.json();
      if(!Array.isArray(levels)) { container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>"; return; }
      levels.forEach((lvl, idx)=> lvl.position = idx+1);

      // gather accepted submissions
      let accepted = [];
      if(supabaseClient){
        try{
          const { data, error } = await supabaseClient
            .from('submissions')
            .select('player,progress,level_id,status')
            .eq('status','accepted');
          if(error){ console.error('Error fetching accepted submissions', error); }
          else if(Array.isArray(data)) accepted = data;
        }catch(e){
          console.error('Supabase fetch accepted error', e);
        }
      }

      // local overrides (from localStorage) also count
      const userMap = new Map();

      // process supabase accepted submissions
      (accepted || []).forEach(rec => {
        const name = rec.player || rec.holder;
        if(!name) return;
        if(!userMap.has(name)) userMap.set(name, { name, completedCount:0, completedLevels: new Set() });
        const u = userMap.get(name);
        // consider every accepted submission a completion (or check rec.progress === '100%')
        u.completedCount++;
        u.completedLevels.add(String(rec.level_id || rec.levelId));
      });

      // local overrides
      try{
        const local = JSON.parse(localStorage.getItem('papan_records_overrides') || '{}');
        Object.keys(local).forEach(levelId => {
          (local[levelId] || []).forEach(rec => {
            const name = rec.holder;
            if(!name) return;
            if(!userMap.has(name)) userMap.set(name, { name, completedCount:0, completedLevels: new Set() });
            const u = userMap.get(name);
            u.completedCount++;
            u.completedLevels.add(String(levelId));
          });
        });
      }catch(e){ /* ignore */ }

      const users = Array.from(userMap.values()).sort((a,b)=> b.completedCount - a.completedCount || a.name.localeCompare(b.name));

      if(users.length === 0){
        container.innerHTML = "<p style='color:var(--muted)'>No hay usuarios todavía.</p>";
        return;
      }

      const rows = users.map((u, idx) => {
        return `<div class="user-card">
          <div class="left">
            <div class="rank">${idx+1}</div>
            <div>
              <a href="player.html?player=${encodeURIComponent(u.name)}" style="font-weight:800;color:var(--accent)">${escapeHtml(u.name)}</a>
              <div style="color:var(--muted);font-size:13px">${u.completedCount} completed</div>
            </div>
          </div>
        </div>`;
      }).join('');

      container.innerHTML = `<h2 style="margin:0 0 12px">User ranking</h2><div>${rows}</div>`;

    }catch(err){
      console.error(err);
      container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
    }
  })();

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

})();