// news.js
(function(){
  const container = document.getElementById('newsContent');

  // Load manual news and snapshots in parallel
  Promise.all([
    fetchMaybe('data/news.json'),
    fetchMaybe('data/positions_snapshots.json'),
    fetchMaybe('data/levels.json')
  ]).then(([newsData, snapshotsData, levelsData])=>{
    const news = Array.isArray(newsData) ? newsData : [];
    const snapshots = Array.isArray(snapshotsData) ? snapshotsData : [];
    const levels = Array.isArray(levelsData) ? levelsData : [];

    // render manual news
    let html = '';
    if(news.length){
      html += '<h3 style="margin-top:0">Recent manual news</h3>';
      html += '<ul>' + news.slice().reverse().map(n => `<li><strong>${escapeHtml(n.title||'')}</strong> — <span style="color:var(--muted)">${escapeHtml(n.date||'')}</span><div style="color:var(--muted);margin-top:6px">${escapeHtml(n.body||'')}</div></li>`).join('') + '</ul>';
    } else {
      html += '<h3 style="margin-top:0">Manual news</h3><p style="color:var(--muted)">No hay noticias manuales (data/news.json).</p>';
    }

    // snapshots: if at least 2 snapshots, diff last two
    if(snapshots.length >= 2){
      const last = snapshots[snapshots.length-1];
      const prev = snapshots[snapshots.length-2];

      // expected snapshot format: { date: '2026-03-12', positions: { levelId: position, ... } }
      const moved = [];
      for(const id in last.positions){
        const newPos = last.positions[id];
        const oldPos = prev.positions[id];
        if(oldPos && newPos && oldPos !== newPos){
          moved.push({ id, from: oldPos, to: newPos, delta: newPos - oldPos });
        }
      }

      html += '<h3 style="margin-top:18px">Auto-detected moves</h3>';
      if(moved.length){
        // enrich with level names if possible
        html += '<ul>' + moved.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).map(m=>{
          const lvl = levels.find(x=>x.id===m.id);
          const name = lvl ? lvl.name : m.id;
          const dir = m.delta < 0 ? '↑ moved up' : '↓ moved down';
          return `<li><strong>${escapeHtml(name)}</strong> (${m.id}) — ${dir} from #${m.from} to #${m.to}</li>`;
        }).join('') + '</ul>';
      } else {
        html += '<p style="color:var(--muted)">No se detectaron cambios entre las últimas dos instantáneas.</p>';
      }

      html += `<div style="color:var(--muted);margin-top:10px">Snapshot dates: ${escapeHtml(prev.date)} → ${escapeHtml(last.date)}</div>`;
    } else {
      html += '<h3 style="margin-top:18px">Auto-detected moves</h3><p style="color:var(--muted)">Faltan snapshots (data/positions_snapshots.json) o menos de 2 snapshots.</p>';
    }

    // also show new levels from last snapshot compared to prev
    // If news items contain "new_level" type they will be shown already.

    container.innerHTML = html;
  });

  // helper fetch that returns null on 404
  function fetchMaybe(path){
    return fetch(path).then(r => {
      if(!r.ok) return null;
      return r.json();
    }).catch(()=>null);
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
})();