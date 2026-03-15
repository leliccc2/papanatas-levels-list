// users.js - ranking by completed count using Supabase accepted submissions
(function(){
  const container = document.getElementById('usersContent');

  // Supabase init (same keys)
  const supabaseUrl = 'https://hlvvxgljcrwjuelmascs.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsdnZ4Z2xqY3J3anVlbG1hc2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTc0MjEsImV4cCI6MjA4OTE3MzQyMX0.r1bS2NeloY1EgtdlJH-ZqLyOzgIpoL2Y_qsRGQIOYiM';
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

  async function build(){
    container.innerHTML = 'Cargando...';
    try{
      const levelsResp = await fetch('data/levels.json');
      const levels = await levelsResp.json();
      if(!Array.isArray(levels)) return container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";
      levels.forEach((lvl, idx)=> lvl.position = idx+1);

      // get accepted submissions from Supabase
      const { data: accepted, error } = await supabaseClient
        .from('submissions')
        .select('*')
        .eq('status','accepted');

      if(error){ console.error('Error fetching accepted submissions', error); }

      // build user map
      const userMap = new Map();

      // From accepted submissions (DB)
      (accepted || []).forEach(rec => {
        const name = rec.player || rec.holder;
        if(!name) return;
        if(!userMap.has(name)) userMap.set(name, { name, completedCount:0, completedLevels:new Set() });
        const u = userMap.get(name);
        // treat 100% as completed (or store all accepted submissions)
        if(String(rec.progress||'').trim() === '100%' || true){
          u.completedCount++;
          u.completedLevels.add(String(rec.level_id || rec.levelId));
        }
      });

      // Also include any local overrides (in case some accepted were stored locally)
      try{
        const local = JSON.parse(localStorage.getItem('papan_records_overrides') || '{}');
        Object.keys(local).forEach(levelId => {
          (local[levelId] || []).forEach(rec => {
            const name = rec.holder;
            if(!name) return;
            if(!userMap.has(name)) userMap.set(name, { name, completedCount:0, completedLevels:new Set() });
            const u = userMap.get(name);
            u.completedCount++;
            u.completedLevels.add(String(levelId));
          });
        });
      }catch(e){ /* ignore */ }

      const users = Array.from(userMap.values()).sort((a,b)=> b.completedCount - a.completedCount || a.name.localeCompare(b.name));

      if(users.length === 0) return container.innerHTML = "<p style='color:var(--muted)'>No hay usuarios todavía.</p>";

      const rows = users.map((u, idx) => {
        return `<div class="user-card">
          <div class="left">
            <div class="rank">${idx+1}</div>
            <div>
              <a href="player.html?player=${encodeURIComponent(u.name)}" style="font-weight:800;color:var(--accent)">${escapeHtml(u.name)}</a>
              <div style="color:var(--muted);font-size:13px">${u.completedCount} completed</div>
            </div>
          </div>
          <div style="color:var(--muted);font-size:13px">${u.completedCount ? '' : ''}</div>
        </div>`;
      }).join('');

      container.innerHTML = `<h2 style="margin:0 0 12px">User ranking</h2><div>${rows}</div>`;
    }catch(err){
      console.error(err);
      container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
    }
  }

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  build();
  

})();