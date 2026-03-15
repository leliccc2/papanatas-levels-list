// ui.js - FINAL: sidebar toggle + Submit a record modal + admin review, signin & record-management
(function(){
  'use strict';

  // -----------------------
  // Basic sidebar toggle (kept behavior)
  // -----------------------
  try { document.documentElement.classList.add('no-animate'); } catch(e){}
  const sidebarToggle = document.getElementById('sidebarToggle');
  try {
    const v = sessionStorage.getItem('papan_sidebar_hidden');
    if(v === '1') document.body.classList.add('sidebar-hidden');
    else document.body.classList.remove('sidebar-hidden');
  }catch(e){}
  requestAnimationFrame(()=> requestAnimationFrame(()=> { try{ document.documentElement.classList.remove('no-animate'); } catch(e){} }));

  if(sidebarToggle) sidebarToggle.addEventListener('click', ()=>{
    const hidden = document.body.classList.toggle('sidebar-hidden');
    try { sessionStorage.setItem('papan_sidebar_hidden', hidden ? '1' : '0'); } catch(e){}
  });

  // -----------------------
  // Config / constants
  // -----------------------
  const ADMIN_KEY = '171213';        // admin PIN as requested
  const ADMIN_NAME = 'Owner';
  const KNOWN_PLAYERS = ['Lelike','Carlos','Marc','Billy','Yoyi','Eiron456'];

  const SUB_KEY = 'papan_submissions';
  const RECS_KEY = 'papan_records_overrides';
  const ISADMIN_KEY = 'papan_is_admin';
  const CURRENT_USER_KEY = 'papan_current_user';

  // -----------------------
  // Styles injection
  // -----------------------
  (function injectStyles(){
    const css = `
.papan-submit-btn{ position:fixed; right:18px; bottom:18px; z-index:1200; background: linear-gradient(180deg, var(--accent-strong), var(--accent)); color:#0b0b0b; border-radius:14px; padding:12px 14px; font-weight:800; border:none; cursor:pointer; box-shadow:0 10px 30px rgba(0,0,0,0.45); }
.papan-submit-btn:hover{ transform: translateY(-3px); }

.papan-admin-bar{ position:fixed; left:18px; bottom:18px; z-index:1200; display:flex; flex-direction:column; gap:8px; }
.papan-admin-badge{ padding:8px 10px; border-radius:10px; background:rgba(0,0,0,0.6); color:var(--accent); border:1px solid rgba(255,255,255,0.03); font-weight:800; cursor:pointer; }

.papan-modal-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; z-index:99999; }
.papan-modal{ width:980px; max-width:96%; background:var(--card); border-radius:12px; padding:18px; box-shadow:0 28px 60px rgba(0,0,0,0.7); border:1px solid rgba(255,255,255,0.03); color:var(--white); }
.papan-form-row{ display:flex; gap:12px; margin-bottom:12px; align-items:center; }
.papan-form-col{ flex:1; display:flex; flex-direction:column; gap:6px; }
.papan-form-label{ font-size:13px; color:var(--muted); font-weight:700; }
.papan-input, .papan-textarea, .papan-select{ background:#0b0b0b; border:1px solid rgba(255,255,255,0.04); color:var(--white); padding:10px; border-radius:8px; outline:none; }
.papan-textarea{ min-height:84px; resize:vertical; }
.papan-suggestions{ max-height:220px; overflow:auto; background:var(--card); border:1px solid rgba(255,255,255,0.03); border-radius:8px; margin-top:6px; padding:6px; }
.papan-suggestion-item{ padding:8px; border-radius:8px; cursor:pointer; }
.papan-suggestion-item:hover{ background:rgba(255,255,255,0.02); }
.papan-file-preview{ width:180px; height:110px; object-fit:cover; border-radius:8px; border:1px solid rgba(255,255,255,0.03); background:#0b0b0b; }
.papan-primary{ background:var(--accent); color:#111; padding:10px 12px; border-radius:10px; border:none; font-weight:800; cursor:pointer; }
.papan-muted{ background:#111; color:var(--muted); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.03); cursor:pointer; }
.papan-subtle{ color:var(--muted); font-size:13px; }
.papan-file-wrap{ display:flex; gap:8px; align-items:center; }
.papan-file-btn{ padding:8px 10px; border-radius:8px; background:linear-gradient(180deg,#111,#0b0b0b); border:1px solid rgba(255,255,255,0.04); color:var(--muted); font-weight:800; cursor:pointer; position:relative; overflow:hidden; }
.papan-file-name{ color:var(--muted); font-size:13px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.papan-notif-badge{ background:#ff6b6b;color:#111;padding:2px 6px;border-radius:999px;font-weight:800;margin-left:6px;font-size:12px; }
`;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  })();

  // -----------------------
  // Helpers
  // -----------------------
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function safeParse(s, fallback){ try{ return JSON.parse(s||'[]'); }catch(e){ return fallback; } }
  function ensureLevelsLoad(){
    if(window._papan_levels_cache) return Promise.resolve(window._papan_levels_cache);
    return fetch('data/levels.json').then(r=>r.json()).then(data=> { window._papan_levels_cache = Array.isArray(data) ? data : []; return window._papan_levels_cache; }).catch(e=>{ window._papan_levels_cache = []; return window._papan_levels_cache; });
  }

  // storage helpers
  function loadSubmissions(){ return safeParse(localStorage.getItem(SUB_KEY), []); }
  function saveSubmissions(arr){ localStorage.setItem(SUB_KEY, JSON.stringify(arr)); }
  function loadOverrides(){ return safeParse(localStorage.getItem(RECS_KEY), {}); }
  function saveOverrides(obj){ localStorage.setItem(RECS_KEY, JSON.stringify(obj)); }

  function getCurrentUser(){ return sessionStorage.getItem(CURRENT_USER_KEY) || null; }
  function setCurrentUser(name){
    if(!name){ sessionStorage.removeItem(CURRENT_USER_KEY); updateUserUI(); return; }
    sessionStorage.setItem(CURRENT_USER_KEY, String(name));
    // when signing in as a user, ensure admin is logged out (can't be both)
    if(localStorage.getItem(ISADMIN_KEY) === '1') localStorage.removeItem(ISADMIN_KEY);
    updateUserUI();
  }
  function isAdminLogged(){ return localStorage.getItem(ISADMIN_KEY) === '1'; }
  function setAdminLogged(val){
    if(val){
      localStorage.setItem(ISADMIN_KEY,'1');
      // admin cannot be a user at the same time
      sessionStorage.removeItem(CURRENT_USER_KEY);
    } else {
      localStorage.removeItem(ISADMIN_KEY);
    }
    updateUserUI();
  }

  function pushNotification(playerName, text){
    try{
      const key = `papan_notifications_${playerName}`;
      const arr = safeParse(localStorage.getItem(key), []);
      arr.push({ id: 'n_' + Date.now(), text, date: new Date().toISOString().slice(0,10), read:false });
      localStorage.setItem(key, JSON.stringify(arr));
      updateUserUI();
      return true;
    }catch(e){ console.error(e); return false; }
  }

  function addRecordOverride(levelId, record){
    try{
      const obj = loadOverrides();
      if(!Array.isArray(obj[levelId])) obj[levelId] = [];
      const exists = obj[levelId].some(r => r.holder === record.holder && r.progress === record.progress && r.date === record.date);
      if(!exists) obj[levelId].push(record);
      saveOverrides(obj);
      return true;
    }catch(e){ console.error(e); return false; }
  }

  // -----------------------
  // UI elements: floating buttons + modals
  // -----------------------
  // Floating submit
  const submitBtn = document.createElement('button');
  submitBtn.className = 'papan-submit-btn';
  submitBtn.textContent = 'Submit a record';
  document.body.appendChild(submitBtn);

  // Admin bar (vertical, review above admin login)
  const adminBar = document.createElement('div'); adminBar.className = 'papan-admin-bar';
  const reviewToggleBtn = document.createElement('button'); reviewToggleBtn.className = 'papan-admin-badge'; reviewToggleBtn.textContent = 'Review';
  const adminLoginBtn = document.createElement('button'); adminLoginBtn.className = 'papan-admin-badge'; adminLoginBtn.textContent = 'Admin login';
  const deleteRecordsBtn = document.createElement('button'); deleteRecordsBtn.className = 'papan-admin-badge'; deleteRecordsBtn.textContent = 'Delete records';
  const signInBtn = document.createElement('button'); signInBtn.className = 'papan-admin-badge'; signInBtn.textContent = 'Sign in';
  const notifSpan = document.createElement('span'); notifSpan.className = 'papan-notif-badge'; notifSpan.style.display = 'none';
  signInBtn.appendChild(notifSpan);

  // set defaults: review & delete hidden until admin
  reviewToggleBtn.style.display = 'none';
  deleteRecordsBtn.style.display = 'none';

  adminBar.appendChild(reviewToggleBtn);
  adminBar.appendChild(adminLoginBtn);
  adminBar.appendChild(deleteRecordsBtn);
  adminBar.appendChild(signInBtn);
  document.body.appendChild(adminBar);

  // Submit modal (uses session user, no player selection in form)
  function buildSubmitModal(){
    const wrap = document.createElement('div'); wrap.className = 'papan-modal-backdrop'; wrap.style.display = 'none';
    wrap.innerHTML = `
      <div class="papan-modal" role="dialog" aria-modal="true">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:900;font-size:16px">Submit a record</div>
          <div><button id="papanClose" class="papan-muted">Cerrar</button></div>
        </div>

        <div class="papan-form-row">
          <div class="papan-form-col" style="flex:2">
            <div class="papan-form-label">Buscar nivel</div>
            <input id="papanLevelSearch" class="papan-input" placeholder="Start typing to search a level" autocomplete="off" />
            <div id="papanSug" class="papan-suggestions" style="display:none"></div>
            <div id="papanLevelInfo" class="papan-subtle" style="margin-top:6px"></div>
          </div>

          <div style="width:220px">
            <div class="papan-form-label">Captura</div>
            <img id="papanPreview" class="papan-file-preview" src="images/placeholder.png" alt="preview" />
            <div style="margin-top:8px">
              <div class="papan-file-wrap">
                <label class="papan-file-btn">Select image
                  <input id="papanFile" type="file" accept="image/png,image/jpeg" />
                </label>
                <div id="papanFileName" class="papan-file-name">No file selected</div>
              </div>
            </div>
          </div>
        </div>

        <div class="papan-form-row">
          <div class="papan-form-col">
            <div class="papan-form-label">Progreso (%)</div>
            <input id="papanPercent" class="papan-input" type="number" min="0" max="100" placeholder="Introduce porcentaje, e.g. 100" />
          </div>

          <div class="papan-form-col">
            <div class="papan-form-label">Player / Usuario</div>
            <div id="papanSignedUser" class="papan-subtle">Sign in to submit as a user</div>
          </div>
        </div>

        <div style="margin-bottom:12px">
          <div class="papan-form-label">Notas / Comentarios (opcional)</div>
          <textarea id="papanNotes" class="papan-textarea" placeholder="Añade contexto: dónde, cómo, intentos, etc."></textarea>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;align-items:center">
          <button id="papanSubmitBtn" class="papan-primary">Enviar</button>
          <button id="papanCancelBtn" class="papan-muted">Cancelar</button>
        </div>

      </div>
    `;
    document.body.appendChild(wrap);

    const search = wrap.querySelector('#papanLevelSearch');
    const sug = wrap.querySelector('#papanSug');
    const info = wrap.querySelector('#papanLevelInfo');
    const fileInput = wrap.querySelector('#papanFile');
    const preview = wrap.querySelector('#papanPreview');
    const fname = wrap.querySelector('#papanFileName');
    const signedUser = wrap.querySelector('#papanSignedUser');

    let selectedLevel = null;
    let currentFileBase64 = null;

    wrap.querySelector('#papanClose').addEventListener('click', ()=> wrap.style.display = 'none');
    wrap.querySelector('#papanCancelBtn').addEventListener('click', ()=> wrap.style.display = 'none');

    // open hook: update signed user display and reset form
    wrap._onOpen = function(){
      const cur = getCurrentUser();
      signedUser.textContent = cur ? `Submitting as: ${cur}` : 'Sign in to submit as a user';
      preview.src = 'images/placeholder.png';
      fileInput.value = '';
      fname.textContent = 'No file selected';
      currentFileBase64 = null;
      wrap.querySelector('#papanPercent').value = '';
      wrap.querySelector('#papanNotes').value = '';
      search.value = '';
      info.innerHTML = '';
      selectedLevel = null;
    };

    // autocomplete
    search.addEventListener('input', ()=>{
      const q = (search.value||'').trim().toLowerCase();
      if(!q){ sug.style.display='none'; info.innerHTML=''; selectedLevel = null; return; }
      ensureLevelsLoad().then(list=>{
        const results = list.filter(l => {
          return (l.name||'').toLowerCase().includes(q) ||
                 (l.creator||'').toLowerCase().includes(q) ||
                 (l.id||'').toLowerCase().includes(q);
        }).slice(0,12);
        if(results.length === 0){ sug.style.display='none'; info.innerHTML='No hay resultados'; selectedLevel = null; return; }
        sug.innerHTML = results.map(r => `<div class="papan-suggestion-item" data-id="${escapeHtml(r.id)}"><strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.creator||'')} <div class="papan-subtle">#${escapeHtml(r.id)}</div></div>`).join('');
        sug.style.display = 'block';
        Array.from(sug.querySelectorAll('.papan-suggestion-item')).forEach(el=>{
          el.addEventListener('click', ()=>{
            const lid = el.dataset.id;
            const lvl = (window._papan_levels_cache||[]).find(x=>String(x.id)===String(lid));
            if(lvl){
              selectedLevel = lvl;
              search.value = lvl.name;
              sug.style.display='none';
              info.innerHTML = `by ${escapeHtml(lvl.creator)} — Position #${lvl.position||'?'} — Tier: ${escapeHtml(lvl.tier||'-')}`;
            }
          });
        });
      });
    });

    // file input handling
    fileInput.addEventListener('change', (ev)=>{
      const f = ev.target.files && ev.target.files[0];
      if(!f){ preview.src='images/placeholder.png'; currentFileBase64 = null; fname.textContent='No file selected'; return; }
      if(!['image/png','image/jpeg'].includes(f.type)){ alert('Sólo png/jpg permitidos.'); fileInput.value=''; fname.textContent='No file selected'; return; }
      fname.textContent = f.name;
      const reader = new FileReader();
      reader.onload = function(e){ preview.src = e.target.result; currentFileBase64 = e.target.result; };
      reader.readAsDataURL(f);
    });

    // submit handler uses current signed user
    wrap.querySelector('#papanSubmitBtn').addEventListener('click', ()=>{
      const curUser = getCurrentUser();
      if(!curUser){ alert('Debes iniciar sesión con un usuario antes de enviar. Usa Sign in (bottom-left).'); return; }

      const lvlQuery = (search.value||'').trim();
      if(!selectedLevel || selectedLevel.name !== lvlQuery){ alert('Selecciona un nivel válido desde la lista (escribe y selecciona).'); return; }

      const percentVal = Number((wrap.querySelector('#papanPercent').value||'').trim());
      if(isNaN(percentVal) || percentVal < 0 || percentVal > 100){ alert('Introduce un porcentaje válido entre 0 y 100.'); return; }

      const notes = (wrap.querySelector('#papanNotes').value || '').trim();
      const date = new Date().toISOString().slice(0,10);

      if(!currentFileBase64){
        if(!confirm('No has adjuntado una imagen. ¿Enviar sin captura?')) return;
      }

      const sub = {
        id: 'sub_' + Date.now() + '_' + Math.floor(Math.random()*9999),
        levelId: selectedLevel.id,
        levelName: selectedLevel.name,
        progress: String(percentVal) + '%',
        holder: curUser,
        notes: notes,
        image: currentFileBase64 || null,
        date: date,
        status: 'pending',
        reviewer: null
      };

      try{
        const arr = loadSubmissions();
        arr.push(sub);
        saveSubmissions(arr);
      }catch(e){ alert('No se pudo guardar la submisión: ' + e); return; }

      alert('Enviado. La submisión está en estado PENDING y será revisada por el admin.');
      wrap.style.display = 'none';
    });

    return wrap;
  }
  const papanModal = buildSubmitModal();
  submitBtn.addEventListener('click', ()=> { papanModal.style.display = 'flex'; if(typeof papanModal._onOpen === 'function') papanModal._onOpen(); });

  // -----------------------
  // Sign-in modal (choose or create)
  // -----------------------
  function buildSignInModal(){
    const wrap = document.createElement('div'); wrap.className = 'papan-modal-backdrop'; wrap.style.display = 'none';
    wrap.innerHTML = `
      <div class="papan-modal" role="dialog" aria-modal="true">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:900;font-size:16px">Sign in</div>
          <div><button id="papanSignClose" class="papan-muted">Cerrar</button></div>
        </div>
        <div style="margin-bottom:12px">
          <div class="papan-form-label">Choose existing user</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${KNOWN_PLAYERS.map(p => `<button class="papan-muted papan-quickuser" data-name="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join(' ')}
          </div>
        </div>
        <div style="margin-bottom:12px">
          <div class="papan-form-label">Or type a name</div>
          <input id="papanSignName" class="papan-input" placeholder="Type a name..." />
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="papanSignInBtn" class="papan-primary">Sign in</button>
          <button id="papanSignCancel" class="papan-muted">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    wrap.querySelector('#papanSignClose').addEventListener('click', ()=> wrap.style.display='none');
    wrap.querySelector('#papanSignCancel').addEventListener('click', ()=> wrap.style.display='none');

    Array.from(wrap.querySelectorAll('.papan-quickuser')).forEach(b=>{
      b.addEventListener('click', ()=> wrap.querySelector('#papanSignName').value = b.dataset.name);
    });

    wrap.querySelector('#papanSignInBtn').addEventListener('click', ()=>{
      const name = (wrap.querySelector('#papanSignName').value || '').trim();
      if(!name){ alert('Escribe un nombre para iniciar sesión.'); return; }
      // signing in as user must log out admin if any
      localStorage.removeItem(ISADMIN_KEY);
      sessionStorage.setItem(CURRENT_USER_KEY, name);
      wrap.style.display = 'none';
      updateUserUI();
      alert('Signed in as ' + name);
    });

    return wrap;
  }
  const signInModal = buildSignInModal();

  // -----------------------
  // Review modal (admin)
  // -----------------------
  function buildReviewModal(){
    const wrap = document.createElement('div'); wrap.className = 'papan-modal-backdrop'; wrap.style.display = 'none';
    wrap.innerHTML = `
      <div class="papan-modal" role="dialog" aria-modal="true">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:900;font-size:16px">Reviews — Submissions</div>
          <div><button id="papanReviewClose" class="papan-muted">Cerrar</button></div>
        </div>
        <div id="papanReviewList" class="papan-review-list"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px">
          <button id="papanReviewRefresh" class="papan-muted" style="margin-right:8px">Refrescar</button>
          <button id="papanReviewClose2" class="papan-muted">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    wrap.querySelector('#papanReviewClose').addEventListener('click', ()=> wrap.style.display='none');
    wrap.querySelector('#papanReviewClose2').addEventListener('click', ()=> wrap.style.display='none');
    wrap.querySelector('#papanReviewRefresh').addEventListener('click', ()=> renderReviewList());
    return wrap;
  }
  const reviewModal = buildReviewModal();

  // -----------------------
  // Delete Records modal (admin)
  // -----------------------
  function buildDeleteRecordsModal(){
    const wrap = document.createElement('div'); wrap.className = 'papan-modal-backdrop'; wrap.style.display = 'none';
    wrap.innerHTML = `
      <div class="papan-modal" role="dialog" aria-modal="true">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:900;font-size:16px">Delete records (admin)</div>
          <div><button id="papanDelClose" class="papan-muted">Cerrar</button></div>
        </div>
        <div id="papanDelList" style="max-height:420px;overflow:auto"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px">
          <button id="papanDelRefresh" class="papan-muted" style="margin-right:8px">Refrescar</button>
          <button id="papanDelClose2" class="papan-muted">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    wrap.querySelector('#papanDelClose').addEventListener('click', ()=> wrap.style.display='none');
    wrap.querySelector('#papanDelClose2').addEventListener('click', ()=> wrap.style.display='none');
    wrap.querySelector('#papanDelRefresh').addEventListener('click', ()=> renderDeleteList());
    return wrap;
  }
  const delModal = buildDeleteRecordsModal();

  // -----------------------
  // Render functions for modals
  // -----------------------
  function renderReviewList(){
    const listNode = reviewModal.querySelector('#papanReviewList');
    listNode.innerHTML = '';
    const arr = loadSubmissions().slice().reverse();
    if(!arr.length){ listNode.innerHTML = '<div class="papan-subtle">No hay submisiones.</div>'; return; }

    arr.forEach(sub => {
      const card = document.createElement('div');
      card.style = 'padding:12px;border-radius:10px;background:var(--card);margin-bottom:8px;border:1px solid rgba(255,255,255,0.02);';
      card.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <img src="${sub.image || 'images/placeholder.png'}" onerror="this.onerror=null;this.src='images/placeholder.png'" style="width:140px;height:84px;object-fit:cover;border-radius:8px">
          <div style="flex:1">
            <div style="font-weight:800">${escapeHtml(sub.levelName)} <span class="papan-subtle">#${escapeHtml(sub.levelId)}</span></div>
            <div style="color:var(--muted);margin-top:6px">${escapeHtml(sub.holder)} — ${escapeHtml(sub.progress)} — ${escapeHtml(sub.date)}</div>
            <div style="margin-top:8px;color:var(--muted);font-size:13px">${escapeHtml(sub.notes||'')}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="papan-accept papan-primary">Aceptar</button>
            <button class="papan-deny papan-muted">Denegar</button>
          </div>
        </div>
      `;
      // accept handler: add override, notify user, remove submission
      card.querySelector('.papan-accept').addEventListener('click', ()=>{
        if(!isAdminLogged()){ alert('No eres admin.'); return; }
        if(!confirm('Aceptar esta submisión? (se añadirá a records del nivel)')) return;
        // add override
        addRecordOverride(sub.levelId, { holder: sub.holder, progress: sub.progress, date: sub.date });
        // remove submission
        const arr = loadSubmissions();
        const kept = arr.filter(x => x.id !== sub.id);
        saveSubmissions(kept);
        // notify
        pushNotification(sub.holder, `Tu submisión para "${sub.levelName}" (${sub.progress}) ha sido ACEPTADA.`);
        // refresh UI
        renderReviewList();
        updateUserUI();
        alert('Submisión aceptada y añadida a records.');
      });
      card.querySelector('.papan-deny').addEventListener('click', ()=>{
        if(!isAdminLogged()){ alert('No eres admin.'); return; }
        const reason = prompt('Motivo (opcional):');
        // remove submission
        const arr = loadSubmissions();
        const kept = arr.filter(x => x.id !== sub.id);
        saveSubmissions(kept);
        // notify
        pushNotification(sub.holder, `Tu submisión para "${sub.levelName}" (${sub.progress}) ha sido DENEGADA.${reason ? ' Motivo: '+reason : ''}`);
        renderReviewList();
        updateUserUI();
        alert('Submisión denegada.');
      });

      listNode.appendChild(card);
    });
  }

  function renderDeleteList(){
    const listNode = delModal.querySelector('#papanDelList');
    listNode.innerHTML = '';
    const obj = loadOverrides();
    const keys = Object.keys(obj);
    if(!keys.length){ listNode.innerHTML = '<div class="papan-subtle">No hay record overrides guardados.</div>'; return; }

    keys.forEach(levelId => {
      const arr = Array.isArray(obj[levelId]) ? obj[levelId] : [];
      const section = document.createElement('div');
      section.style = 'margin-bottom:12px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.01);';
      section.innerHTML = `<div style="font-weight:800;margin-bottom:6px">${escapeHtml(levelId)}</div>`;
      arr.forEach((rec, idx) => {
        const r = document.createElement('div');
        r.style = 'display:flex;justify-content:space-between;align-items:center;padding:6px;border-radius:6px;margin-bottom:6px;background:var(--card);';
        r.innerHTML = `<div><strong>${escapeHtml(rec.holder)}</strong> — ${escapeHtml(rec.progress)} <div class="papan-subtle">${escapeHtml(rec.date||'')}</div></div><div><button class="papan-muted">Eliminar</button></div>`;
        r.querySelector('.papan-muted').addEventListener('click', ()=> {
          if(!isAdminLogged()){ alert('No eres admin.'); return; }
          if(!confirm('Eliminar este record override?')) return;
          const obj2 = loadOverrides();
          if(Array.isArray(obj2[levelId])) obj2[levelId] = obj2[levelId].filter((_,i)=>i!==idx);
          if(obj2[levelId].length === 0) delete obj2[levelId];
          saveOverrides(obj2);
          renderDeleteList();
        });
        section.appendChild(r);
      });
      listNode.appendChild(section);
    });
  }

  // -----------------------
  // Wiring admin / sign-in buttons
  // -----------------------
  adminLoginBtn.addEventListener('click', ()=>{
    if(isAdminLogged()){
      if(confirm('Cerrar sesión admin?')){ setAdminLogged(false); alert('Admin logged out'); }
      return;
    }
    const key = prompt('Introduce admin PIN:');
    if(!key) return;
    if(String(key) === String(ADMIN_KEY)){
      setAdminLogged(true);
      // ensure admin is not also a user
      sessionStorage.removeItem(CURRENT_USER_KEY);
      alert('Admin access granted.');
      updateUserUI();
    } else {
      alert('PIN incorrecto.');
    }
  });

  reviewToggleBtn.addEventListener('click', ()=>{
    if(!isAdminLogged()){ alert('Necesitas ser admin.'); return; }
    renderReviewList();
    reviewModal.style.display = 'flex';
  });

  deleteRecordsBtn.addEventListener('click', ()=>{
    if(!isAdminLogged()){ alert('Necesitas ser admin.'); return; }
    renderDeleteList();
    delModal.style.display = 'flex';
  });

  signInBtn.addEventListener('click', ()=>{
    const cur = getCurrentUser();
    if(cur){
      if(confirm(`Cerrar sesión (${cur})?`)){ setCurrentUser(null); alert('Logged out'); }
      return;
    }
    // open sign-in modal
    signInModal.style.display = 'flex';
  });

  // create signIn modal wiring (buttons declared earlier via buildSignInModal)
  // (we already built signInModal at creation time)
  // find sign-in elements and attach behavior is done inside the modal creation (above)

  // -----------------------
  // Update UI bits (admin & user badges)
  // -----------------------
  function updateUserUI(){
    // admin state
    if(isAdminLogged()){
      adminLoginBtn.textContent = 'Admin: ' + ADMIN_NAME;
      reviewToggleBtn.style.display = '';
      deleteRecordsBtn.style.display = '';
      // sign-in button should show plain text (admin cannot be user)
      signInBtn.textContent = 'Admin';
      notifSpan.style.display = 'none';
    } else {
      adminLoginBtn.textContent = 'Admin login';
      reviewToggleBtn.style.display = 'none';
      deleteRecordsBtn.style.display = 'none';
      // user badge
      const cur = getCurrentUser();
      if(cur){
        signInBtn.textContent = `User: ${cur}`;
        const count = getUnreadCount(cur);
        if(count > 0){ notifSpan.textContent = String(count); notifSpan.style.display = ''; } else { notifSpan.style.display = 'none'; }
      } else {
        signInBtn.textContent = 'Sign in';
        notifSpan.style.display = 'none';
      }
    }
  }

  function getUnreadCount(user){
    if(!user) return 0;
    try{
      const arr = safeParse(localStorage.getItem(`papan_notifications_${user}`), []);
      return Array.isArray(arr) ? arr.filter(n => !n.read).length : 0;
    }catch(e){ return 0; }
  }

  // -----------------------
  // Initial state
  // -----------------------
  (function init(){
    // ensure review and delete hidden until admin
    updateUserUI();
  })();

  // -----------------------
  // Expose small API
  // -----------------------
  window.Papan = window.Papan || {};
  window.Papan.refreshSubmissions = function(){ if(isAdminLogged()) renderReviewList(); };
  window.Papan.openSubmitModal = function(){ papanModal.style.display = 'flex'; if(typeof papanModal._onOpen === 'function') papanModal._onOpen(); };
  window.Papan.setCurrentUser = setCurrentUser;
  window.Papan.isAdmin = isAdminLogged;

})();
