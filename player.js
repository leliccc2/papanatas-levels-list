// player.js - perfil del jugador (bonito) + shows notifications from submissions (accepted/denied)
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

    // gather completed levels by player (100%)
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

    // also include accepted overrides from localStorage (papan_records_overrides)
    try{
      const overrides = JSON.parse(localStorage.getItem('papan_records_overrides') || '{}');
      if(overrides){
        for(const lid in overrides){
          const arr = overrides[lid] || [];
          for(const rec of arr){
            if(String(rec.holder) === String(player) && String(rec.progress).trim() === "100%"){
              // find level details
              const lvl = levels.find(x => String(x.id) === String(lid));
              if(lvl) completed.push({ level: lvl, record: rec });
            }
          }
        }
      }
    }catch(e){
      // ignore
    }

    const total = completed.length;

    // find hardest using difficulty_stars if present (fallback to difficultyScore from earlier)
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

    // notifications (submissions)
    let notificationsHtml = '';
    try{
      const key = `papan_notifications_${player}`;
      const notes = JSON.parse(localStorage.getItem(key) || '[]');
      if(notes && notes.length){
        notificationsHtml = `<div style="margin-top:12px"><div class="section-title">Notificaciones</div><ul style="margin-top:8px">` +
          notes.map(n => `<li>${escapeHtml(n.date)} — ${escapeHtml(n.text)}</li>`).join('') +
          `</ul><div style="margin-top:8px"><button id="clearPlayerNotes" class="papan-muted">Marcar como leídas</button></div></div>`;
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

    // wire clear notifications button
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
    container.innerHTML = "<p style='color:#f66'>Error cargando datos.</p>";
  });

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
})();