// roulette.js - roulette runner: input % enforced, jump-to-P logic, win/fail modals, no "Paso X de 100"; title "Roulette (WIP)"
(function(){
  'use strict';

  // Elementos (asegúrate de que tu HTML tenga estos ids)
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

  let run = null; // { id, createdAt, entries:[], index, results: [] }
  let levels = [];
  let finished = false;

  // set page title as requested
  try { document.title = "Roulette (WIP)"; } catch(e){}

  init();

  function init(){
    // cargar niveles (si falla, la generación seguirá con placeholders)
    fetch('data/levels.json').then(r=>r.json()).then(data=>{
      levels = Array.isArray(data) ? data : [];
    }).catch(e=>{
      console.warn('No se pudieron cargar levels.json para roulette:', e);
      levels = [];
    });

    // listeners
    if(btnGenerate) btnGenerate.addEventListener('click', generateRun);
    if(btnPrev) btnPrev.addEventListener('click', ()=> { if(!run || finished) return; if(run.index>0){ run.index--; refreshUI(); } });
    if(btnNext) btnNext.addEventListener('click', ()=> { if(!run || finished) return; if(run.index < run.entries.length-1){ run.index++; refreshUI(); } });
    if(btnMarkDone) btnMarkDone.addEventListener('click', ()=> markResult(true));
    if(btnMarkFail) btnMarkFail.addEventListener('click', ()=> markFail());
    if(btnApplyPercent) btnApplyPercent.addEventListener('click', applyPercent);

    if(percentInput){
      percentInput.addEventListener('input', ()=> {
        if(!run || finished){ if(btnApplyPercent) btnApplyPercent.disabled = true; return; }
        const val = Number(percentInput.value);
        const min = run.index + 1;
        if(btnApplyPercent) btnApplyPercent.disabled = isNaN(val) || val < min;
      });
      // ensure it's number-friendly
      percentInput.setAttribute('inputmode','numeric');
      percentInput.setAttribute('pattern','[0-9]*');
    }

    refreshUI();
  }

  function generateRun(){
    // build 100 entries cycling the available levels (stable deterministic not required)
    const pool = levels.slice();
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
      results: Array(entries.length).fill(null)
    };
    finished = false;
    if(percentInput) { percentInput.value = ''; btnApplyPercent.disabled = true; }
    refreshUI();
    if(rouletteState) rouletteState.textContent = 'Run generada — lista para empezar.';
  }

  function applyPercent(){
    if(!run || finished) return;
    const raw = (percentInput && percentInput.value) ? percentInput.value.trim() : '';
    if(raw === '') { alert('Introduce un porcentaje válido.'); return; }
    let val = Number(raw);
    if(isNaN(val)) { alert('Introduce un número válido.'); return; }
    if(val < 0) val = 0;
    if(val > 999) val = 999;

    const target = run.index + 1; // required minimum percent for this step
    if(val < target){
      // fallo por intentar poner menor que target -> modal "Has perdido"
      run.results[run.index] = false;
      finished = true;
      refreshUI();
      showModal('Has perdido', 'Has introducido un porcentaje menor al objetivo. La run queda fallada.');
      return;
    }

    // guardamos el número en la posición actual
    run.results[run.index] = val;

    // next index se calcula como floor(val) (0-based target mapping)
    // Ej: val=83 -> nextIndex=83 -> siguiente target mostrado será 84%
    const nextIndex = Math.min(run.entries.length - 1, Math.floor(val));
    if(nextIndex >= run.entries.length - 1 || val >= 100){
      run.index = run.entries.length - 1;
      finished = true;
      refreshUI();
      showModal('MUY BIEN!, has ganado', '¡Felicidades! Has completado la roulette.');
      return;
    }

    run.index = nextIndex;
    if(percentInput){ percentInput.value = ''; btnApplyPercent.disabled = true; }
    refreshUI();
  }

  function markResult(ok){
    if(!run || finished) return;
    run.results[run.index] = !!ok;
    if(!ok){
      finished = true;
      refreshUI();
      showModal('Has perdido', 'Has marcado este paso como fallado.');
      return;
    }
    // ok -> advance one index (si no estamos al final)
    if(run.index < run.entries.length - 1){
      run.index++;
      refreshUI();
    } else {
      finished = true;
      refreshUI();
      showModal('MUY BIEN!, has ganado', '¡Felicidades! Has completado la roulette.');
    }
  }

  function markFail(){
    if(!run || finished) return;
    run.results[run.index] = false;
    finished = true;
    refreshUI();
    showModal('Has perdido', 'Has fallado la roulette en este paso.');
  }

  function refreshUI(){
    if(!run){
      if(rouletteContent) rouletteContent.innerHTML = 'Genera una nueva roulette para empezar.';
      if(rouletteProgress) rouletteProgress.textContent = '0 / 0';
      if(btnPrev) btnPrev.disabled = true;
      if(btnNext) btnNext.disabled = true;
      if(btnMarkDone) btnMarkDone.disabled = true;
      if(btnMarkFail) btnMarkFail.disabled = true;
      if(btnApplyPercent) btnApplyPercent.disabled = true;
      if(percentInput) percentInput.disabled = true;
      return;
    }

    const entry = run.entries[run.index];
    const target = run.index + 1; // 1..100 percent target
    const entryNumber = run.index + 1;

    // render card (sin "Paso X de 100")
    if(rouletteContent){
      rouletteContent.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <img src="${escapeHtml(entry.thumb)}" onerror="this.onerror=null;this.src='images/placeholder.png'" style="width:140px;height:80px;object-fit:cover;border-radius:6px">
          <div>
            <div style="font-weight:800;font-size:18px">${escapeHtml(entry.name)} <span style="color:var(--muted);font-weight:700">#${entryNumber}</span></div>
            <div style="color:var(--muted);margin-top:6px">by ${escapeHtml(entry.creator)} ${entry.gd_id ? '— GD id '+escapeHtml(entry.gd_id) : ''}</div>
            <div style="margin-top:8px"><strong>Target:</strong> <span id="displayTarget">${target}%</span></div>
            <div style="margin-top:6px;color:var(--muted);font-size:13px">
              ${resultDescription(run.results[run.index], target)}
            </div>
          </div>
        </div>
      `;
    }

    // counts
    let doneCount = 0, failCount = 0;
    for(let i=0;i<run.results.length;i++){
      const res = run.results[i];
      if(res === true) doneCount++;
      else if(res === false) failCount++;
      else if(typeof res === 'number'){
        if(res >= (i+1)) doneCount++; else failCount++;
      }
    }

    if(rouletteState) rouletteState.innerHTML = `Hechos: ${doneCount} — Fallados: ${failCount}`;
    if(rouletteProgress) rouletteProgress.textContent = `${entryNumber} / ${run.entries.length}`;

    // controls state
    if(btnPrev) btnPrev.disabled = run.index === 0 || finished;
    if(btnNext) btnNext.disabled = run.index >= run.entries.length - 1 || finished;
    if(btnMarkDone) btnMarkDone.disabled = finished;
    if(btnMarkFail) btnMarkFail.disabled = finished;
    if(percentInput) percentInput.disabled = finished;

    // set min attr so the browser shows minimum value and the UI enforces it
    if(percentInput) percentInput.min = target;

    const curVal = Number(percentInput ? percentInput.value : NaN);
    if(btnApplyPercent) btnApplyPercent.disabled = finished || isNaN(curVal) || curVal < target;
  }

  function resultDescription(res, target){
    if(res === null || res === undefined) return 'Sin registro aún.';
    if(res === true) return `Marcado como completado (≥ ${target}%).`;
    if(res === false) return `Marcado como fallado (< ${target}%).`;
    if(typeof res === 'number') return `Registrado: ${res}% — objetivo ${target}%.`;
    return '';
  }

  // modal helper (simple)
  function showModal(title, text){
    const prev = document.querySelector('.roulette-modal-backdrop');
    if(prev) prev.remove();
    const modal = document.createElement('div');
    modal.className = 'roulette-modal-backdrop';
    modal.style = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999';
    modal.innerHTML = `
      <div style="background:var(--card);padding:20px;border-radius:12px;max-width:90%;width:420px;text-align:center;border:1px solid rgba(255,255,255,0.03)">
        <h3 style="margin:0 0 8px">${escapeHtml(title)}</h3>
        <div style="color:var(--muted);margin-bottom:16px">${escapeHtml(text)}</div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button id="modalClose" style="padding:8px 12px;border-radius:8px;background:var(--accent);border:none;font-weight:800">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#modalClose').addEventListener('click', ()=> modal.remove());
    modal.addEventListener('click', (e)=> { if(e.target === modal) modal.remove(); });
  }

  // small helpers
  function shuffle(array){
    for(let i = array.length -1; i > 0; i--){
      const j = Math.floor(Math.random() * (i+1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

})();