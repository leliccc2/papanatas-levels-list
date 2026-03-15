// roulette.js - roulette runner actualizado: input % en lugar de Start, no guardar, muestra #numero
(function(){
  const btnGenerate = document.getElementById('btnGenerate');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnMarkDone = document.getElementById('btnMarkDone');
  const btnMarkFail = document.getElementById('btnMarkFail');
  const btnApplyPercent = document.getElementById('btnApplyPercent');
  const percentInput = document.getElementById('percentInput');

  const rouletteContent = document.getElementById('rouletteContent');
  const rouletteState = document.getElementById('rouletteState');
  const rouletteProgress = document.getElementById('rouletteProgress');

  let run = null; // { id, createdAt, entries: [{levelId, name, creator, thumb, gd_id}], index, results: [] }
  let levels = [];

  init();

  function init(){
    fetch('data/levels.json').then(r=>r.json()).then(data=>{
      levels = Array.isArray(data) ? data : [];
    }).catch(e=>{
      console.warn('No se pudieron cargar levels.json para roulette:', e);
    });

    btnGenerate.addEventListener('click', generateRun);
    btnPrev.addEventListener('click', ()=> { if(!run) return; if(run.index>0){ run.index--; refreshUI(); } });
    btnNext.addEventListener('click', ()=> { if(!run) return; if(run.index < run.entries.length-1){ run.index++; refreshUI(); } });
    btnMarkDone.addEventListener('click', ()=> markResult(true));
    btnMarkFail.addEventListener('click', ()=> markResult(false));
    btnApplyPercent.addEventListener('click', applyPercent);

    percentInput.addEventListener('input', ()=> {
      btnApplyPercent.disabled = !run || !percentInput.value.trim();
    });
  }

  function generateRun(){
    const pool = levels.slice();
    // shuffle
    shuffle(pool);
    const entries = [];
    const needed = 100;
    if(pool.length === 0){
      alert('No hay niveles en data/levels.json para generar la roulette.');
      return;
    }
    for(let i=0;i<needed;i++){
      const idx = i % pool.length;
      const lvl = pool[idx];
      entries.push({
        levelId: lvl ? lvl.id : `placeholder_${i}`,
        name: lvl ? lvl.name : `Random Level ${i+1}`,
        creator: lvl ? lvl.creator : 'Unknown',
        gd_id: lvl ? lvl.gd_id : '',
        thumb: lvl ? `images/levels/${lvl.id}.png` : 'images/placeholder.png'
      });
    }

    run = {
      id: 'run_' + Date.now(),
      createdAt: new Date().toISOString(),
      entries,
      index: 0,
      results: Array(entries.length).fill(null) // store true/false or numeric percent
    };

    refreshUI();
    rouletteState.textContent = 'Run generada — lista para empezar.';
    btnApplyPercent.disabled = false;
  }

  function applyPercent(){
    if(!run) return;
    const raw = percentInput.value.trim();
    if(raw === '') return alert('Introduce un porcentaje válido.');
    let val = Number(raw);
    if(isNaN(val)) return alert('Introduce un número válido.');
    // clamp to reasonable
    if(val < 0) val = 0;
    if(val > 999) val = 999;
    run.results[run.index] = val; // store numeric percent
    // auto-advance if not last
    if(run.index < run.entries.length - 1) run.index++;
    percentInput.value = '';
    btnApplyPercent.disabled = true;
    refreshUI();
  }

  function markResult(ok){
    if(!run) return;
    run.results[run.index] = !!ok;
    if(run.index < run.entries.length - 1) run.index++;
    refreshUI();
  }

  function refreshUI(){
    if(!run){
      rouletteContent.innerHTML = 'Genera una nueva roulette para empezar.';
      rouletteProgress.textContent = '0 / 0';
      btnPrev.disabled = true; btnNext.disabled = true; btnMarkDone.disabled = true; btnMarkFail.disabled = true; btnApplyPercent.disabled = true;
      return;
    }

    const entry = run.entries[run.index];
    const target = run.index + 1; // 1..100 percent target
    const entryNumber = run.index + 1;
    const targetPercent = `${target}%`;

    // show main card (include #numero next to name)
    rouletteContent.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${escapeHtml(entry.thumb)}" onerror="this.onerror=null;this.src='images/placeholder.png'" style="width:140px;height:80px;object-fit:cover;border-radius:6px">
        <div>
          <div style="font-weight:800;font-size:18px">${escapeHtml(entry.name)} <span style="color:var(--muted);font-weight:700">#${entryNumber}</span></div>
          <div style="color:var(--muted);margin-top:6px">by ${escapeHtml(entry.creator)} ${entry.gd_id ? '— GD id '+escapeHtml(entry.gd_id) : ''}</div>
          <div style="margin-top:8px"><strong>Target:</strong> ${targetPercent}</div>
          <div style="color:var(--muted);margin-top:6px">Paso ${entryNumber} de ${run.entries.length}</div>
          <div style="margin-top:6px;color:var(--muted);font-size:13px">
            ${resultDescription(run.results[run.index], target)}
          </div>
        </div>
      </div>
    `;

    const done = run.results.filter(r=> (r === true) || (typeof r === 'number' && r >= (run.results.indexOf(r)+1))).length;
    // Above calculation for done counts numbers >= their target — but that indexOf trick is unreliable for duplicates.
    // We'll compute done/failed more robustly:
    let doneCount = 0, failCount = 0;
    for(let i=0;i<run.results.length;i++){
      const res = run.results[i];
      if(res === true) doneCount++;
      else if(res === false) failCount++;
      else if(typeof res === 'number'){
        if(res >= (i+1)) doneCount++; else failCount++;
      }
    }

    rouletteState.innerHTML = `Hechos: ${doneCount} — Fallados: ${failCount}`;
    rouletteProgress.textContent = `${entryNumber} / ${run.entries.length}`;

    btnPrev.disabled = run.index === 0;
    btnNext.disabled = run.index >= run.entries.length - 1;
    btnMarkDone.disabled = false;
    btnMarkFail.disabled = false;
  }

  function resultDescription(res, target){
    if(res === null || res === undefined) return 'Sin registro aún.';
    if(res === true) return `Marcado como completado (≥ ${target}%).`;
    if(res === false) return `Marcado como fallado (< ${target}%).`;
    if(typeof res === 'number') return `Registrado: ${res}% — objetivo ${target}%.`;
    return '';
  }

  // helpers
  function shuffle(array){
    for(let i = array.length -1; i > 0; i--){
      const j = Math.floor(Math.random() * (i+1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

})();
