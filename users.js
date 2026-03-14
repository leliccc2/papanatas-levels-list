// users.js - produces ranking by completed count (no hardest column)
(function(){
  const container = document.getElementById('usersContent');

  fetch('data/levels.json').then(r=>r.json()).then(levels=>{
    if(!Array.isArray(levels)) return container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";

    levels.forEach((lvl, idx)=> lvl.position = idx+1);

    const userMap = new Map();
    levels.forEach(lvl => {
      (lvl.records||[]).forEach(rec=>{
        const name = rec.holder;
        const prog = String(rec.progress||'').trim();
        if(!userMap.has(name)) userMap.set(name, {name, completedCount:0, completedLevels:[]});
        const u = userMap.get(name);
        if(prog === "100%"){
          u.completedCount++;
          u.completedLevels.push(lvl);
        }
      });
    });

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
  }).catch(err=>{
    console.error(err);
    container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
  });

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
})();