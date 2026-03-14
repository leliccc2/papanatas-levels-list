// player.js - perfil del jugador (bonito, restaurado)
(function(){
  function qs(k){ return new URLSearchParams(location.search).get(k) }
  const player = qs('player');
  const container = document.getElementById('playerContent');
  if(!player){ container.innerHTML = "<p style='color:var(--muted)'>No se indicó jugador.</p>"; return; }

  fetch('data/levels.json').then(r=>r.json()).then(levels=>{
    if(!Array.isArray(levels)){
      container.innerHTML = "<p style='color:#f66'>Formato JSON inválido.</p>";
      return;
    }

    levels.forEach((lvl, idx) => lvl.position = idx + 1);

    // gather completed levels
    const completed = [];
    levels.forEach(lvl => {
      if(Array.isArray(lvl.records)){
        for(const rec of lvl.records){
          if(String(rec.holder) === String(player) && String(rec.progress).trim() === "100%"){
            completed.push({ level: lvl, record: rec });
            break;
          }
        }
      }
    });

    const total = completed.length;

    // find hardest using difficulty_stars if present
    let hardest = null;
    function starsValue(l){
      if(l && l.difficulty_stars){
        const m = String(l.difficulty_stars).match(/(\d+)/);
        if(m) return parseInt(m[1],10);
      }
      return 0;
    }
    completed.forEach(c => {
      if(!hardest) hardest = c.level;
      else if(starsValue(c.level) > starsValue(hardest)) hardest = c.level;
    });

    document.title = player + " — PAPANATAS";

    const completedListHTML = completed.length
      ? completed.map(c => `<li><a href="level.html?id=${encodeURIComponent(c.level.id)}">${escapeHtml(c.level.name)}</a></li>`).join('')
      : '<li style="color:var(--muted)">No ha completado niveles</li>';

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
    `;
  }).catch(err=>{
    console.error(err);
    container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
  });

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
})();