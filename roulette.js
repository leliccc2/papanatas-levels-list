// roulette.js - roulette runner: input % enforced, jump-to-P logic, win/fail modals, no "Paso X de 100"
(function(){
  'use strict';

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

  init();

  function init(){
    fetch('data/levels.json').then(r=>r.json()).then(data=>{
      levels = Array.isArray(data) ? data : [];
    }).catch(e=>{
      console.warn('No se pudieron cargar levels.json para roulette:', e);
    });

    btnGenerate.addEventListener('click', generateRun);
    btnPrev.addEventListener('click', ()=> { if(!run || finished) return; if(run.index>0){ run.index--; refreshUI(); } });
    btnNext.addEventListener('click', ()=> { if(!run || finished) return; if(run.index < run.entries.length-1){ run.index++; refreshUI(); } });
    btnMarkDone.addEventListener('click', ()=> markResult(true));
    btnMarkFail.addEventListener('click', ()=> markFail());
    btnApplyPercent.addEventListener('click', applyPercent);

    percentInput.addEventListener('input', ()=> {
      if(!run || finished){ btnApplyPercent.disabled = true; return; }
      const val = Number(percentInput.value);
      const min = run.index + 1;
      // disable apply unless numeric and >= target
      btnApplyPercent.disabled = isNaN(val) || val < min;
    });

    refreshUI();
  }

  function generateRun(){
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
    percentInput.value = '';
    btnApplyPercent.disabled = true;
    refreshUI();
    rouletteState.textContent = 'Run generada — lista para empezar.';
  }

  function applyPercent(){
    if(!run || finished) return;
    const raw = percentInput.value.trim();
    if(raw === '') return alert('Introduce un porcentaje válido.');
    let val = Number(raw);
    if(isNaN(val)) return alert('Introduce un número válido.');
    // clamp to reasonable
    if(val < 0) val = 0;
    if(val > 999) val = 999;

    const target = run.index + 1; // required minimum percent for this step
    if(val < target){
      // no permitido: es trampa -> fallo
      run.results[run.index] = false;
      finished = true;
      refreshUI();
      showModal('Has perdido', 'Has introducido un porcentaje menor al objetivo. La run queda fallada.');
      return;
    }

    // store the percent at current position
    run.results[run.index] = val;

    // compute next index: floor(val) clamped to last index
    const nextIndex = Math.min(run.entries.length - 1, Math.floor(val));
    if(nextIndex >= run.entries.length - 1 || val >= 100){
      // win
      run.index = run.entries.length - 1;
      finished = true;
      refreshUI();
      showModal('MUY BIEN!, has ganado', '¡Felicidades! Has completado la roulette.');
      return;
    }

    // advance to nextIndex
    run.index = nextIndex;
    percentInput.value = '';
    btnApplyPercent.disabled = true;
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
    // ok -> advance one step
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
      rouletteContent.innerHTML = 'Genera una nueva roulette para empezar.';
      rouletteProgress.textContent = '0 / 0';
      btnPrev.disabled = true; btnNext.disabled = true; btnMarkDone.disabled = true; btnMarkFail.disabled = true; btnApplyPercent.disabled = true;
      percentInput.disabled = true;
      return;
    }

    const entry = run.entries[run.index];
    const target = run.index + 1; // target % displayed = index+1
    const targetPercent = `${target}%`;

    // main card (no "Paso X de 100")
    rouletteContent.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${escapeHtml(entry.thumb)}" onerror="this.onerror=null;this.src='images/placeholder.png'" style="width:140px;height:80px;object-fit:cover;border-radius:6px">
        <div>
          <div style="font-weight:800;font-size:18px">${escapeHtml(entry.name)} <span style="color:var(--muted);font-weight:700">#${run.index+1}</span></div>
          <div style="color:var(--muted);margin-top:6px">by ${escapeHtml(entry.creator)} ${entry.gd_id ? '— GD id '+escapeHtml(entry.gd_id) : ''}</div>
          <div style="margin-top:8px"><strong>Target:</strong> <span id="displayTarget">${targetPercent}</span></div>
          <div style="margin-top:6px;color:var(--muted);font-size:13px">
            ${resultDescription(run.results[run.index], target)}
          </div>
        </div>
      </div>
    `;

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

    rouletteState.innerHTML = `Hechos: ${doneCount} — Fallados: ${failCount}`;
    rouletteProgress.textContent = `${run.index + 1} / ${run.entries.length}`;

    // inputs/buttons state
    btnPrev.disabled = run.index === 0 || finished;
    btnNext.disabled = run.index >= run.entries.length - 1 || finished;
    btnMarkDone.disabled = finished;
    btnMarkFail.disabled = finished;
    percentInput.disabled = finished;
    // set min attribute so user sees the minimum
    percentInput.min = target;
    const curVal = Number(percentInput.value || '');
    btnApplyPercent.disabled = finished || isNaN(curVal) || curVal < target;
  }

  function resultDescription(res, target){
    if(res === null || res === undefined) return 'Sin registro aún.';
    if(res === true) return `Marcado como completado (≥ ${target}%).`;
    if(res === false) return `Marcado como fallado (< ${target}%).`;
    if(typeof res === 'number') return `Registrado: ${res}% — objetivo ${target}%.`;
    return '';
  }

  // modal helper
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

  // helpers
  function shuffle(array){
    for(let i = array.length -1; i > 0; i--){
      const j = Math.floor(Math.random() * (i+1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

})();