// ui.js - toggle sidebar + submit modal, admin review & minor helpers
(function(){
  // add no-animate class immediately to prevent CSS transitions on initial state
  try { document.documentElement.classList.add('no-animate'); } catch(e){}

  const btn = document.getElementById('sidebarToggle');

  // apply stored state synchronously (before removing no-animate)
  try{
    const v = sessionStorage.getItem('papan_sidebar_hidden');
    if(v === '1') document.body.classList.add('sidebar-hidden');
    else document.body.classList.remove('sidebar-hidden');
  }catch(e){
    // ignore
  }

  // remove no-animate after a frame so future transitions animate
  requestAnimationFrame(()=> {
    requestAnimationFrame(()=> {
      try { document.documentElement.classList.remove('no-animate'); } catch(e){}
    });
  });

  if(!btn) return;
  btn.addEventListener('click', ()=> {
    const hidden = document.body.classList.toggle('sidebar-hidden');
    try { sessionStorage.setItem('papan_sidebar_hidden', hidden ? '1' : '0'); } catch(e){}
  });

  /* ===== NEW: Submission system + admin review UI (injected into all pages) =====
     - Floating "Submit proof" button
     - Submit modal: level search, percent, player select, "other", notes, image upload
     - Submissions saved to localStorage:papan_submissions
     - Admin login (client-side pass) required to accept/deny
     - Accepted records are stored in localStorage:papan_records_overrides
     - Notifications for players saved under papan_notifications_<playername>
  */

  // CONFIG: change ADMIN_KEY to something only you know
  const ADMIN_KEY = 'papana_secret_admin_key_please_change'; // <<--- change this to your secret
  const ADMIN_NAME = 'Owner'; // label to store in reviewer field when accepting

  // helper small css injection for the floating button & modal
  (function injectStyles(){
    const css = `
/* submit floating button */
.papan-submit-btn {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 1200;
  background: linear-gradient(180deg, var(--accent-strong), var(--accent));
  color:#0b0b0b;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.45);
  font-weight:800;
  cursor:pointer;
  border: none;
}
.papan-submit-btn:hover{ transform: translateY(-3px); }

/* modal */
.papan-modal-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:99999; }
.papan-modal{ width:820px; max-width:96%; background:var(--card); border-radius:12px; padding:18px; box-shadow:0 28px 60px rgba(0,0,0,0.7); border:1px solid rgba(255,255,255,0.03); color:var(--white); }
.papan-form-row{ display:flex; gap:12px; margin-bottom:12px; align-items:center; }
.papan-form-col{ flex:1; display:flex; flex-direction:column; gap:6px; }
.papan-form-label{ font-size:13px; color:var(--muted); font-weight:700; }
.papan-input, .papan-textarea, .papan-select { background:#0b0b0b; border:1px solid rgba(255,255,255,0.04); color:var(--white); padding:10px; border-radius:8px; outline:none; }
.papan-textarea{ min-height:84px; resize:vertical; }
.papan-suggestions{ max-height:180px; overflow:auto; background:var(--card); border:1px solid rgba(255,255,255,0.03); border-radius:8px; margin-top:6px; padding:6px; }
.papan-suggestion-item{ padding:8px; border-radius:8px; cursor:pointer; }
.papan-suggestion-item:hover{ background:rgba(255,255,255,0.02); }
.papan-file-preview{ width:180px; height:96px; object-fit:cover; border-radius:8px; border:1px solid rgba(255,255,255,0.03); }
.papan-primary{ background:var(--accent); color:#111; padding:10px 12px; border-radius:10px; border:none; font-weight:800; cursor:pointer; }
.papan-muted{ background:#111; color:var(--muted); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.03); cursor:pointer; }
.papan-admin-bar{ position: fixed; left:18px; bottom:18px; z-index:1200; display:flex; gap:8px; }
.papan-admin-badge{ padding:8px 10px; border-radius:10px; background:rgba(0,0,0,0.6); color:var(--accent); border:1px solid rgba(255,255,255,0.03); font-weight:800; cursor:pointer;}
.papan-review-list{ max-height:420px; overflow:auto; margin-top:8px; }
.papan-subtle{ color:var(--muted); font-size:13px; }
    `;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  })();

  // create floating submit button
  const submitBtn = document.createElement('button');
  submitBtn.className = 'papan-submit-btn';
  submitBtn.title = 'Enviar prueba / submit proof';
  submitBtn.innerText = 'Submit a record';
  document.body.appendChild(submitBtn);

  // small admin controls area (login / review) inserted bottom-left
  const adminBar = document.createElement('div');
  adminBar.className = 'papan-admin-bar';
  const adminLoginBtn = document.createElement('button');
  adminLoginBtn.className = 'papan-admin-badge';
  adminLoginBtn.textContent = 'Admin login';
  adminBar.appendChild(adminLoginBtn);
  const reviewToggleBtn = document.createElement('button');
  reviewToggleBtn.className = 'papan-admin-badge';
  reviewToggleBtn.textContent = 'Review';
  reviewToggleBtn.style.display = 'none';
  adminBar.appendChild(reviewToggleBtn);
  document.body.appendChild(adminBar);

  // helper: load levels list cache
  let _levelsCache = null;
  function ensureLevelsLoad(){
    if(Array.isArray(_levelsCache)) return Promise.resolve(_levelsCache);
    return fetch('data/levels.json').then(r=>r.json()).then(data=> { _levelsCache = Array.isArray(data) ? data : []; return _levelsCache; }).catch(e=>{ _levelsCache = []; return _levelsCache; });
  }

  // create the modal markup (hidden by default)
  function buildSubmitModal(){
    const wrap = document.createElement('div');
    wrap.className = 'papan-modal-backdrop';
    wrap.style.display = 'none';

    wrap.innerHTML = `
      <div class="papan-modal" role="dialog" aria-modal="true">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:900;font-size:16px">Enviar prueba / Submit proof</div>
          <div><button id="papanClose" class="papan-muted">Cerrar</button></div>
        </div>

        <div class="papan-form-row">
          <div class="papan-form-col" style="flex:2">
            <div class="papan-form-label">Buscar nivel</div>
            <input id="papanLevelSearch" class="papan-input" placeholder="Start typing to search a level" autocomplete="off" />
            <div id="papanSug" class="papan-suggestions" style="display:none"></div>
            <div id="papanLevelInfo" class="papan-subtle" style="margin-top:6px"></div>
          </div>

          <div style="width:180px">
            <div class="papan-form-label">Captura</div>
            <img id="papanPreview" class="papan-file-preview" src="images/placeholder.png" alt="preview" />
            <div style="margin-top:8px">
              <input id="papanFile" type="file" accept="image/png,image/jpeg" />
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
            <select id="papanPlayerSelect" class="papan-select">
              <option>Selecciona...</option>
              <option>Lelike</option>
              <option>Carlos</option>
              <option>Marc</option>
              <option>Billy</option>
              <option>Yoyi</option>
              <option>Eiron456</option>
              <option>Otro</option>
            </select>
            <input id="papanPlayerOther" class="papan-input" placeholder="Tu nombre (si elegiste Otro)" style="display:none;margin-top:8px" />
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

    // event hooks
    const papanClose = wrap.querySelector('#papanClose');
    const papanCancel = wrap.querySelector('#papanCancelBtn');
    papanClose.addEventListener('click', ()=> wrap.style.display='none');
    papanCancel.addEventListener('click', ()=> wrap.style.display='none');

    // search autocomplete
    const search = wrap.querySelector('#papanLevelSearch');
    const sug = wrap.querySelector('#papanSug');
    const info = wrap.querySelector('#papanLevelInfo');
    let selectedLevel = null;

    search.addEventListener('input', ()=> {
      const q = (search.value || '').trim().toLowerCase();
      if(!q){ sug.style.display='none'; info.innerHTML=''; selectedLevel = null; return; }
      ensureLevelsLoad().then(list=>{
        const results = list.filter(l => {
          return (l.name||'').toLowerCase().includes(q) ||
                 (l.creator||'').toLowerCase().includes(q) ||
                 (l.id||'').toLowerCase().includes(q);
        }).slice(0,12);
        if(results.length===0){ sug.style.display='none'; info.innerHTML='No hay resultados'; selectedLevel = null; return; }
        sug.innerHTML = results.map(r => `<div class="papan-suggestion-item" data-id="${escapeHtml(r.id)}"><strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.creator || '')} <div class="papan-subtle">#${escapeHtml(r.id)}</div></div>`).join('');
        sug.style.display = 'block';
        // wire click
        Array.from(sug.querySelectorAll('.papan-suggestion-item')).forEach(el=>{
          el.addEventListener('click', ()=>{
            const lid = el.dataset.id;
            const lvl = list.find(x=>String(x.id)===String(lid));
            if(lvl){
              selectedLevel = lvl;
              search.value = lvl.name;
              sug.style.display='none';
              info.innerHTML = `by ${escapeHtml(lvl.creator)} — Position #${lvl.position || '?'} — Tier: ${escapeHtml(lvl.tier||'-')}`;
            }
          });
        });
      });
    });

    // file upload preview -> load base64 later on submit
    const fileInput = wrap.querySelector('#papanFile');
    const preview = wrap.querySelector('#papanPreview');
    let currentFileBase64 = null;
    fileInput.addEventListener('change', (ev)=>{
      const f = ev.target.files && ev.target.files[0];
      if(!f) { preview.src='images/placeholder.png'; currentFileBase64 = null; return; }
      if(!['image/png','image/jpeg'].includes(f.type)){
        alert('Sólo png/jpg permitidos.');
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function(e){ preview.src = e.target.result; currentFileBase64 = e.target.result; };
      reader.readAsDataURL(f);
    });

    // player selection: show other input when selected 'Otro'
    const playerSelect = wrap.querySelector('#papanPlayerSelect');
    const playerOther = wrap.querySelector('#papanPlayerOther');
    playerSelect.addEventListener('change', ()=>{
      if(playerSelect.value === 'Otro'){ playerOther.style.display = ''; playerOther.focus(); }
      else playerOther.style.display = 'none';
    });

    // submit
    const submit = wrap.querySelector('#papanSubmitBtn');
    submit.addEventListener('click', ()=>{
      // validate
      const lvlQuery = (search.value || '').trim();
      if(!selectedLevel || selectedLevel.name !== lvlQuery){
        alert('Selecciona un nivel válido desde la lista (escribe y selecciona).');
        return;
      }
      const percentVal = Number((wrap.querySelector('#papanPercent').value || '').trim());
      if(isNaN(percentVal) || percentVal < 0 || percentVal > 100){
        alert('Introduce un porcentaje válido entre 0 y 100.');
        return;
      }
      let playerName = playerSelect.value;
      if(playerName === 'Selecciona...' || !playerName){ alert('Selecciona un jugador.'); return; }
      if(playerName === 'Otro'){
        playerName = (playerOther.value || '').trim();
        if(!playerName){ alert('Escribe tu nombre (otro).'); return; }
      }

      const notes = (wrap.querySelector('#papanNotes').value || '').trim();
      const date = new Date().toISOString().slice(0,10);

      // ensure we have an image - optional? You demanded attach a photo; enforce it.
      if(!currentFileBase64){
        if(!confirm('No has adjuntado una imagen. ¿Quieres enviar sin captura? (recomendado incluir evidencia)')) {
          return;
        }
      }

      // build submission object
      const sub = {
        id: 'sub_' + Date.now() + '_' + Math.floor(Math.random()*9999),
        levelId: selectedLevel.id,
        levelName: selectedLevel.name,
        progress: String(percentVal) + '%',
        holder: playerName,
        notes: notes,
        image: currentFileBase64 || null,
        date: date,
        status: 'pending', // pending | accepted | denied
        reviewer: null
      };

      // persist to localStorage
      try{
        const raw = localStorage.getItem('papan_submissions') || '[]';
        const arr = JSON.parse(raw);
        arr.push(sub);
        localStorage.setItem('papan_submissions', JSON.stringify(arr));
      }catch(e){
        alert('No se pudo guardar la submisión en localStorage: ' + e);
        return;
      }

      // feedback
      alert('Enviado. La submisión está en estado PENDING y será revisada por el admin.');
      wrap.style.display = 'none';
      // reset form basic
      search.value=''; info.innerHTML=''; playerSelect.value='Selecciona...'; playerOther.value=''; playerOther.style.display='none';
      wrap.querySelector('#papanPercent').value=''; wrap.querySelector('#papanNotes').value=''; fileInput.value=''; preview.src='images/placeholder.png'; currentFileBase64 = null;
    });

    return wrap;
  }

  // attach modal to body
  const papanModal = buildSubmitModal();

  // open modal on floating button click
  submitBtn.addEventListener('click', ()=> { papanModal.style.display = 'flex'; });

  // Admin login & review
  let isAdmin = (localStorage.getItem('papan_is_admin') === '1');
  function updateAdminUI(){
    if(isAdmin){
      adminLoginBtn.textContent = 'Admin: ' + ADMIN_NAME;
      reviewToggleBtn.style.display = '';
    } else {
      adminLoginBtn.textContent = 'Admin login';
      reviewToggleBtn.style.display = 'none';
    }
  }
  updateAdminUI();

  adminLoginBtn.addEventListener('click', ()=> {
    if(isAdmin){
      if(confirm('Cerrar sesión como admin?')){ isAdmin = false; localStorage.removeItem('papan_is_admin'); updateAdminUI(); }
      return;
    }
    const key = prompt('Introduce la clave de acceso');
    if(!key) return;
    if(key === 171213){
      isAdmin = true; localStorage.setItem('papan_is_admin','1'); updateAdminUI();
      alert('Acceso admin concedido.');
    } else {
      alert('Clave incorrecta.');
    }
  });

  // build review modal (admin)
  function buildReviewModal(){
    const wrap = document.createElement('div');
    wrap.className = 'papan-modal-backdrop';
    wrap.style.display = 'none';
    wrap.innerHTML = `
      <div class="papan-modal" role="dialog" aria-modal="true">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:900;font-size:16px">Reviews — Submisiones pendientes</div>
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

  // wire the review toggle button
  reviewToggleBtn.addEventListener('click', ()=> {
    if(!isAdmin){ alert('Primero haz login como admin'); return; }
    renderReviewList();
    reviewModal.style.display = 'flex';
  });

  // render list of submissions
  function renderReviewList(){
    const listNode = reviewModal.querySelector('#papanReviewList');
    listNode.innerHTML = '';
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem('papan_submissions') || '[]'); } catch(e){ arr = []; }
    if(!arr.length){ listNode.innerHTML = '<div class="papan-subtle">No hay submisiones.</div>'; return; }

    // show most recent first
    arr = arr.slice().reverse();

    arr.forEach(sub => {
      const card = document.createElement('div');
      card.style = 'padding:12px;border-radius:10px;background:var(--card);margin-bottom:8px;border:1px solid rgba(255,255,255,0.02);';
      card.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <img src="${sub.image || 'images/placeholder.png'}" onerror="this.onerror=null;this.src='images/placeholder.png'" style="width:120px;height:68px;object-fit:cover;border-radius:8px">
          <div style="flex:1">
            <div style="font-weight:800">${escapeHtml(sub.levelName)} <span class="papan-subtle">#${escapeHtml(sub.levelId)}</span></div>
            <div style="color:var(--muted);margin-top:6px">${escapeHtml(sub.holder)} — ${escapeHtml(sub.progress)} — ${escapeHtml(sub.date)}</div>
            <div style="margin-top:8px;color:var(--muted);font-size:13px">${escapeHtml(sub.notes||'')}</div>
            <div style="margin-top:8px" class="papan-subtle">Status: ${escapeHtml(sub.status)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="papan-accept papan-primary">Aceptar</button>
            <button class="papan-deny papan-muted">Denegar</button>
          </div>
        </div>
      `;
      // accept / deny handlers
      card.querySelector('.papan-accept').addEventListener('click', ()=> {
        if(!isAdmin){ alert('No eres admin.'); return; }
        if(!confirm('Aceptar esta submisión? (se añadirá a records del nivel)')) return;
        // mark accepted in storage
        setSubmissionStatus(sub.id, 'accepted', ADMIN_NAME);
        // add to records overrides
        addRecordOverride(sub.levelId, { holder: sub.holder, progress: sub.progress, date: sub.date });
        // add notification to user
        pushNotification(sub.holder, `Tu submisión para "${sub.levelName}" (${sub.progress}) ha sido ACEPTADA.`);
        renderReviewList();
      });
      card.querySelector('.papan-deny').addEventListener('click', ()=> {
        if(!isAdmin){ alert('No eres admin.'); return; }
        const reason = prompt('Motivo (opcional):');
        setSubmissionStatus(sub.id, 'denied', ADMIN_NAME, reason || null);
        pushNotification(sub.holder, `Tu submisión para "${sub.levelName}" (${sub.progress}) ha sido DENEGADA.${reason ? ' Motivo: '+reason : ''}`);
        renderReviewList();
      });

      listNode.appendChild(card);
    });
  }

  // helper: set submission status
  function setSubmissionStatus(subId, status, reviewer, reason){
    try{
      const arr = JSON.parse(localStorage.getItem('papan_submissions') || '[]');
      const idx = arr.findIndex(s=>s.id === subId);
      if(idx === -1) return false;
      arr[idx].status = status;
      arr[idx].reviewer = reviewer || null;
      if(reason) arr[idx].review_reason = reason;
      localStorage.setItem('papan_submissions', JSON.stringify(arr));
      return true;
    }catch(e){
      console.error(e); return false;
    }
  }

  // helper: add record override to a level
  function addRecordOverride(levelId, record){
    try{
      const key = 'papan_records_overrides';
      const raw = localStorage.getItem(key) || '{}';
      const obj = JSON.parse(raw);
      if(!Array.isArray(obj[levelId])) obj[levelId] = [];
      // prevent exact duplicates
      const exists = obj[levelId].some(r => r.holder === record.holder && r.progress === record.progress && r.date === record.date);
      if(!exists) obj[levelId].push(record);
      localStorage.setItem(key, JSON.stringify(obj));
      return true;
    }catch(e){
      console.error(e); return false;
    }
  }

  // helper: push notification to a player
  function pushNotification(playerName, text){
    try{
      const key = `papan_notifications_${playerName}`;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ id: 'n_' + Date.now(), text, date: new Date().toISOString().slice(0,10), read:false });
      localStorage.setItem(key, JSON.stringify(arr));
      return true;
    }catch(e){ console.error(e); return false; }
  }

  // helper: hide regenerate packs button if present
  (function hideRegenerateIfPresent(){
    try{
      const regen = document.querySelectorAll('[data-action="regenerate-packs"], .regenerate-packs, #regeneratePacks');
      regen.forEach(el=>el.remove());
    }catch(e){}
  })();

  // small escape utility
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // initial admin state reflect
  (function initAdminState(){
    if(localStorage.getItem('papan_is_admin') === '1'){ isAdmin = true; updateAdminUI(); }
  })();

})();
