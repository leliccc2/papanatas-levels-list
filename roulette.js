// roulette.js - simple roulette runner with 100 steps (1%..100%)
// stores saved runs in localStorage under key 'papan_roulette_runs_v1'
(function(){
  const KEY_RUNS = 'papan_roulette_runs_v1';

  const btnGenerate = document.getElementById('btnGenerate');
  const btnStart = document.getElementById('btnStart');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnMarkDone = document.getElementById('btnMarkDone');
  const btnMarkFail = document.getElementById('btnMarkFail');
  const btnSaveRun = document.getElementById('btnSaveRun');

  const rouletteContent = document.getElementById('rouletteContent');
  const rouletteState = document.getElementById('rouletteState');
  const rouletteProgress = document.getElementById('rouletteProgress');
  const savedRunsEl = document.getElementById('savedRuns');

  let run = null; // { id, createdAt, entries: [{levelId, name, creator, thumb}], index, results: [] }
  let levels = [];

  init();

  function init(){
    loadSavedRunsList();
    fetch('data/levels.json').then(r=>r.json()).then(data=>{
      levels = Array.isArray(data) ? data : [];
    }).catch(e=>{
      console.warn('No se pudieron cargar levels.json para roulette:', e);
    });

    btnGenerate.addEventListener('click', generateRun);
    btnStart.addEventListener('click', ()=> startRun());
    btnPrev.addEventListener('click', ()=> { if(!run) return; if(run.index>0){ run.index--; refreshUI(); } });
    btnNext.addEventListener('click', ()=> { if(!run) return; if(run.index < run.entries.length-1){ run.index++; refreshUI(); } });
    btnMarkDone.addEventListener('click', ()=> markResult(true));
    btnMarkFail.addEventListener('click', ()=> markResult(false));
    btnSaveRun.addEventListener('click', saveCurrentRun);
  }

  function generateRun(){
    const pool = levels.slice();
    // shuffle
    shuffle(pool);
    const entries = [];
    const needed = 100;
    for(let i=0;i<needed;i++){
      // if not enough unique levels, allow repeats by wrapping
      const idx = i % pool.length;
      const lvl = pool[idx];
      entries.push({
        levelId: lvl ? lvl.id : `placeholder_${i}`,
        name: lvl ? lvl.name : `Random Level ${i+1}`,
        creator: lvl ? lvl.creator : 'Unknown',
        gd_id: lvl ? lvl.gd_id : '',
        thumb: lvl ? `images/levels/${lvl.id}.png` : 'images/placeholder.png'
      });
      // if pool shorter than needed, shuffle again after loop? it's OK to wrap deterministically
    }

    run = {
      id: 'run_' + Date.now(),
      createdAt: new Date().toISOString(),
      entries,
      index: 0,
      results: Array(entries.length).fill(null) // true/false/null
    };

    refreshUI();
    btnStart.disabled = false;
    rouletteState.textContent = 'Run generada — lista para empezar.';
  }

  function startRun(){
    if(!run) { alert('Genera una run primero'); return; }
    run.index = 0;
    refreshUI();
    btnStart.disabled = true;
    rouletteState.textContent = 'Run iniciada';
  }

  function markResult(ok){
    if(!run) return;
    run.results[run.index] = !!ok;
    // advance automatically when marking completed or failed (unless last)
    if(run.index < run.entries.length - 1) run.index++;
    refreshUI();
  }

  function refreshUI(){
    if(!run){
      rouletteContent.innerHTML = 'Genera una nueva roulette para empezar.';
      rouletteProgress.textContent = '0 / 0';
      btnPrev.disabled = true; btnNext.disabled = true; btnMarkDone.disabled = true; btnMarkFail.disabled = true; btnSaveRun.disabled = true;
      return;
    }

    const entry = run.entries[run.index];
    const target = run.index + 1; // 1..100 percent target
    const targetPercent = `${target}%`;
    // show main card
    rouletteContent.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${escapeHtml(entry.thumb)}" onerror="this.onerror=null;this.src='images/placeholder.png'" style="width:140px;height:80px;object-fit:cover;border-radius:6px">
        <div>
          <div style="font-weight:800;font-size:18px">${escapeHtml(entry.name)}</div>
          <div style="color:var(--muted);margin-top:6px">by ${escapeHtml(entry.creator)} ${entry.gd_id ? '— GD id '+escapeHtml(entry.gd_id) : ''}</div>
          <div style="margin-top:8px"><strong>Target:</strong> ${targetPercent}</div>
          <div style="color:var(--muted);margin-top:6px">Paso ${run.index + 1} de ${run.entries.length}</div>
        </div>
      </div>
    `;

    const done = run.results.filter(r=> r === true).length;
    const failed = run.results.filter(r=> r === false).length;
    rouletteState.innerHTML = `Hechos: ${done} — Fallados: ${failed}`;
    rouletteProgress.textContent = `${run.index + 1} / ${run.entries.length}`;

    btnPrev.disabled = run.index === 0;
    btnNext.disabled = run.index >= run.entries.length - 1;
    btnMarkDone.disabled = false;
    btnMarkFail.disabled = false;
    btnSaveRun.disabled = false;
  }

  function saveCurrentRun(){
    if(!run) return;
    const name = prompt('Nombre para guardar la run (deja en blanco para usar la fecha):');
    const saveName = name && name.trim() ? name.trim() : ('Roulette ' + new Date(run.createdAt).toLocaleString());
    try{
      const raw = localStorage.getItem(KEY_RUNS);
      const existing = raw ? JSON.parse(raw) : [];
      existing.unshift({ id: run.id, name: saveName, createdAt: run.createdAt, run });
      localStorage.setItem(KEY_RUNS, JSON.stringify(existing.slice(0,50))); // keep up to 50
      alert('Run guardada.');
      loadSavedRunsList();
    }catch(e){
      alert('Error guardando: '+(e && e.message));
    }
  }

  // show saved runs (list with load/delete)
  function loadSavedRunsList(){
    try{
      const raw = localStorage.getItem(KEY_RUNS);
      const arr = raw ? JSON.parse(raw) : [];
      if(!arr.length){
        savedRunsEl.innerHTML = '<div style="color:var(--muted)">No hay runs guardadas.</div>';
        return;
      }
      const html = arr.map((s, idx) => {
        const when = new Date(s.createdAt).toLocaleString();
        return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="flex:1">
            <div style="font-weight:800">${escapeHtml(s.name)}</div>
            <div style="color:var(--muted);font-size:13px">${escapeHtml(when)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-left:8px">
            <button class="tiny-load" data-idx="${idx}" style="padding:6px;border-radius:8px">Load</button>
            <button class="tiny-delete" data-idx="${idx}" style="padding:6px;border-radius:8px;background:#2b2b2b;color:var(--muted)">Del</button>
          </div>
        </div>`;
      }).join('');
      savedRunsEl.innerHTML = html;

      // attach listeners
      savedRunsEl.querySelectorAll('.tiny-load').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const idx = Number(btn.dataset.idx);
          const raw2 = localStorage.getItem(KEY_RUNS);
          const arr2 = raw2 ? JSON.parse(raw2) : [];
          const rec = arr2[idx];
          if(rec && rec.run){
            run = rec.run;
            refreshUI();
            btnStart.disabled = true;
            alert('Run cargada.');
          } else alert('No se pudo cargar la run.');
        });
      });
      savedRunsEl.querySelectorAll('.tiny-delete').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const idx = Number(btn.dataset.idx);
          if(!confirm('Borrar esta run guardada?')) return;
          const raw2 = localStorage.getItem(KEY_RUNS);
          const arr2 = raw2 ? JSON.parse(raw2) : [];
          arr2.splice(idx,1);
          localStorage.setItem(KEY_RUNS, JSON.stringify(arr2));
          loadSavedRunsList();
        });
      });

    }catch(e){
      console.warn('No se pudieron listar runs:', e);
      savedRunsEl.innerHTML = '<div style="color:var(--muted)">Error cargando runs.</div>';
    }
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