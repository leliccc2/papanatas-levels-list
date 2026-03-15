// random.js - modo dual: "generator" (elige niveles existentes) y "creator" (crea JSON)
// cambios: generator muestra la carita de difficulty y botón "Abrir nivel"; el JSON (visual) no aparece en generator mode (se mantiene solo en creator)
(function(){
  const btnGen = document.getElementById('btnRandGenerate');
  const btnCopy = document.getElementById('btnRandCopy');
  const btnSeed = document.getElementById('btnRandSeed');
  const randNameEl = document.getElementById('randName');
  const randCreatorEl = document.getElementById('randCreator');
  const randStatsEl = document.getElementById('randStats');
  const randTagsEl = document.getElementById('randTags');
  const randThumb = document.getElementById('randThumb');
  const randJson = document.getElementById('randJson');
  const randJsonText = document.getElementById('randJsonText');
  const btnOpenLevel = document.getElementById('btnOpenLevel');

  const modeLabel = document.getElementById('modeLabel');
  const modePrev = document.getElementById('modePrev');
  const modeNext = document.getElementById('modeNext');

  let levels = [];
  let mode = 'generator'; // 'generator' | 'creator'
  let lastGenerated = null;

  fetch('data/levels.json').then(r=>r.json()).then(data=>{
    levels = Array.isArray(data) ? data : [];
  }).catch(e=>{
    console.warn('No se pudo cargar levels.json para Random:', e);
  });

  // mode toggles
  const modes = ['generator','creator'];
  function updateModeUI(){
    if(mode === 'generator'){
      modeLabel.textContent = 'Random level generator';
      randThumb.style.display = ''; // show thumbnail
      btnOpenLevel.style.display = 'inline-block';
      // in generator mode we hide JSON area (no JSON generation)
      randJson.style.display = 'none';
      btnCopy.disabled = true;
    }else{
      modeLabel.textContent = 'Random level creator';
      randThumb.style.display = 'none'; // hide photo in creator
      btnOpenLevel.style.display = 'none';
      // creator mode may show JSON area after generation
    }
    // reset UI
    randNameEl.textContent = 'Pulsa Generar';
    randCreatorEl.textContent = '';
    randStatsEl.textContent = '';
    randTagsEl.innerHTML = '';
    randJson.style.display = 'none';
    btnCopy.disabled = true;
    lastGenerated = null;
  }

  modePrev.addEventListener('click', ()=>{
    const i = modes.indexOf(mode);
    mode = modes[(i - 1 + modes.length) % modes.length];
    updateModeUI();
  });
  modeNext.addEventListener('click', ()=>{
    const i = modes.indexOf(mode);
    mode = modes[(i + 1) % modes.length];
    updateModeUI();
  });

  btnGen.addEventListener('click', ()=> generateRandomLevel());
  btnSeed.addEventListener('click', ()=> {
    const seed = prompt('Introduce una semilla (texto o número):');
    generateRandomLevel(seed ? String(seed) : undefined);
  });
  btnCopy.addEventListener('click', ()=> {
    if(!lastGenerated) return;
    copyToClipboard(JSON.stringify(lastGenerated, null, 2));
    alert('JSON copiado al portapapeles.');
  });

  function generateRandomLevel(seed){
    if(mode === 'generator'){
      generateFromExisting(seed);
    } else {
      generateVirtual(seed);
    }
  }

  // Generator: pick a random existing level from levels.json
  function generateFromExisting(seed){
    if(!levels.length){
      alert('No hay niveles en data/levels.json.');
      return;
    }
    let rnd = Math.random;
    if(seed !== undefined){
      const h = hashString(String(seed));
      rnd = mulberry32(h);
    }
    const idx = Math.floor(rnd() * levels.length);
    const lvl = levels[idx];
    if(!lvl){
      alert('No se pudo seleccionar un nivel.');
      return;
    }
    lastGenerated = { mode: 'generator', sourceId: lvl.id, data: lvl };
    renderGeneratorLevel(lvl);
  }

  function renderGeneratorLevel(lvl){
    // name and creator
    randNameEl.textContent = lvl.name;
    // show creator and difficulty icon (instead of difficulty text)
    const diffFilename = difficultyIconFilename(lvl.difficulty);
    const diffPath = `images/icons/${diffFilename}`;
    randCreatorEl.innerHTML = `by ${escapeHtml(lvl.creator)} <img src="${diffPath}" alt="${escapeHtml(lvl.difficulty||'')}" style="width:20px;height:20px;vertical-align:middle;margin-left:8px" onerror="this.style.display='none'">`;
    randStatsEl.textContent = `Duration: ${lvl.duration || '-'} — Objects: ${lvl.objects || '-'}`;
    randTagsEl.innerHTML = (lvl.tags||[]).map(t=>`<span class="tag-pill">${escapeHtml(t)}</span>`).join(' ');
    randThumb.src = `images/levels/${lvl.id}.png`;
    // generator does NOT show JSON block
    randJson.style.display = 'none';
    btnCopy.disabled = true;
    btnOpenLevel.href = `level.html?id=${encodeURIComponent(lvl.id)}`;
    btnOpenLevel.style.display = 'inline-block';
    btnOpenLevel.textContent = 'Abrir nivel';
    // style the open button similarly to other site buttons (it is an anchor but styled)
    btnOpenLevel.className = 'muted-btn';
  }

  // Creator: create a virtual level JSON (old behavior kept)
  function generateVirtual(seed){
    if(!levels.length){
      alert('No hay niveles en data/levels.json para inspirarse.');
      return;
    }
    let rnd = Math.random;
    if(seed !== undefined){
      const h = hashString(String(seed));
      rnd = mulberry32(h);
    }

    // pick 2-4 source levels for mixing
    const picks = [];
    const indices = [...Array(levels.length).keys()];
    shuffleArray(indices, rnd);
    const pickCount = 2 + Math.floor(rnd() * 3);
    for(let i=0;i<indices.length && picks.length < pickCount;i++){
      picks.push(levels[indices[i]]);
    }

    // compose name & attributes
    const nameParts = picks.slice(0,2).map(p => (p.tags && p.tags[0]) ? p.tags[0] : p.creator);
    const flair = ['Hyper','Neon','Echo','Void','Pulse','Turbo','Drift','Flux'][Math.floor(rnd()*8)];
    const num = Math.floor(rnd()*9999);
    const generatedName = `${nameParts.join(' ')} ${flair} #${num}`;

    const diffScores = picks.map(p => difficultyScore(p.difficulty));
    const avgScore = Math.max(1, Math.round(diffScores.reduce((a,b)=>a+b,0)/diffScores.length));
    const difficultyLabel = difficultyLabelFromScore(avgScore);

    const baseObjects = picks.reduce((a,b)=> a + (Number(b.objects)||0), 0);
    const objects = Math.max(150, Math.round((baseObjects / picks.length) * (0.7 + rnd()*0.8)));

    const durations = picks.map(p=> parseDuration(p.duration)).filter(Boolean);
    let durationStr = '0:45';
    if(durations.length){
      const avgSec = Math.round(durations.reduce((a,b)=>a+b,0)/durations.length);
      const secs = Math.round(avgSec * (0.6 + rnd()*1.4));
      durationStr = formatDuration(secs);
    } else {
      durationStr = formatDuration(15 + Math.floor(rnd()*105));
    }

    const tagPool = [];
    picks.forEach(p => (p.tags||[]).forEach(t => { if(!tagPool.includes(t)) tagPool.push(t); }));
    const flavorTags = ['Neon','Flow','Spam Control','Precision','Wave Control','End Heavy','Click Pattern','Consistency'];
    for(let i=0;i<3;i++){
      if(rnd() < 0.35) tagPool.push(flavorTags[Math.floor(rnd()*flavorTags.length)]);
    }
    shuffleArray(tagPool, rnd);
    const tags = Array.from(new Set(tagPool)).slice(0,8);

    const gd_id = String(90000000 + Math.floor(rnd()*89999999));
    const id = `rand_${Date.now().toString(36)}_${Math.floor(rnd()*10000)}`;

    const generated = {
      id,
      name: generatedName,
      creator: "RandomCreator",
      gd_id,
      duration: durationStr,
      objects,
      tier: tierFromScore(avgScore),
      difficulty: difficultyLabel,
      tags,
      date_added: new Date().toISOString().slice(0,10),
      records: []
    };

    lastGenerated = generated;
    renderCreatorLevel(generated);
  }

  function renderCreatorLevel(g){
    randNameEl.textContent = g.name;
    randCreatorEl.textContent = `by ${g.creator} — ${g.tier} • ${g.difficulty}`;
    randStatsEl.textContent = `Duration: ${g.duration} — Objects: ${g.objects}`;
    randTagsEl.innerHTML = (g.tags||[]).map(t=>`<span class="tag-pill">${escapeHtml(t)}</span>`).join(' ');
    randJson.style.display = 'block';
    randJsonText.textContent = JSON.stringify(g, null, 2);
    btnCopy.disabled = false;
    btnOpenLevel.style.display = 'none';
  }

  // helpers (reused)
  function difficultyIconFilename(diff){
    if(!diff) return 'default.png';
    return String(diff).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,'') + '.png';
  }
  function difficultyScore(diff){
    if(!diff) return 2;
    const d = String(diff).toLowerCase();
    if(d.includes('easy')) return 1;
    if(d.includes('normal')) return 2;
    if(d.includes('hard')) return 3;
    if(d.includes('harder')) return 4;
    if(d.includes('insane')) return 5;
    if(d.includes('extreme')) return 6;
    const m = d.match(/(\d+)/);
    return m ? Math.min(6, Math.max(1, Number(m[1])||2)) : 3;
  }
  function difficultyLabelFromScore(s){
    if(s <= 1) return 'easy';
    if(s === 2) return 'normal';
    if(s === 3) return 'hard';
    if(s === 4) return 'harder';
    return 'insane';
  }
  function tierFromScore(s){
    if(s <= 2) return 'Medium';
    if(s === 3) return 'Hard';
    if(s === 4) return 'Insane';
    return 'Insane+';
  }
  function parseDuration(str){
    if(!str) return null;
    const m = String(str).match(/(\d+):(\d+)/);
    if(!m) return null;
    return Number(m[1])*60 + Number(m[2]);
  }
  function formatDuration(sec){
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${m}:${s.toString().padStart(2,'0')}`;
  }
  function shuffleArray(arr, rnd){
    const r = rnd || Math.random;
    for(let i = arr.length -1; i > 0; i--){
      const j = Math.floor(r() * (i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  function copyToClipboard(text){
    try{
      navigator.clipboard.writeText(text);
      return true;
    }catch(e){
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch(e2){}
      ta.remove();
      return false;
    }
  }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function hashString(s){ let h = 2166136261 >>> 0; for(let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
  function mulberry32(a) { return function() { var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } }

  // init UI
  updateModeUI();

})();