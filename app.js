/* (c) 2026 HoloolFlow - حلول فلو | جميع الحقوق محفوظة */
/* ===================================================
   TASK FLOW - app.js v1.1
   Fixes: install prompt, CSV Arabic, backup distinction
   New: CSV import, Excel export/import, social links,
        security watermark, console signature
   =================================================== */

'use strict';

// ===== SECURITY: Console Signature =====
(function() {
  const s = 'color:#6C63FF;font-weight:bold;font-size:13px;';
  console.log('%c╔══════════════════════════════════════╗', s);
  console.log('%c║   Task Flow — HoloolFlow حلول فلو   ║', s);
  console.log('%c║   © 2026 جميع الحقوق محفوظة         ║', s);
  console.log('%c║   Unauthorized modification is       ║', s);
  console.log('%c║   strictly prohibited.               ║', s);
  console.log('%c╚══════════════════════════════════════╝', s);
})();

// ===== SECURITY: Self-healing copyright key =====
(function() {
  const KEY = '_hf_sig', VAL = 'HoloolFlow-2026';
  if (localStorage.getItem(KEY) !== VAL) localStorage.setItem(KEY, VAL);
  setInterval(() => { if (localStorage.getItem(KEY) !== VAL) localStorage.setItem(KEY, VAL); }, 30000);
})();

// ===== APP STATE =====
const APP = {
  tasks: [],
  filter: { status: 'all', category: 'all', search: '' },
  sort: 'createdAt-desc',
  editingId: null,
  detailId: null,
  currentTags: [],
  currentSubtasks: [],
  deferredInstall: null,
  theme: 'dark',
};

const STORAGE_KEY = 'taskflow_tasks_v2';
const SETTINGS_KEY = 'taskflow_settings_v1';

function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(APP.tasks)); }
  catch(e) { showToast('تحذير: مساحة التخزين ممتلئة', 'error'); }
}
function loadTasks() {
  try { APP.tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch(e) { APP.tasks = []; }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: APP.theme })); } catch(e) {}
}
function loadSettings() {
  try { APP.theme = (JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')).theme || 'dark'; }
  catch(e) { APP.theme = 'dark'; }
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function createTask(data) {
  return {
    id: generateId(),
    title: (data.title || '').trim(),
    desc: (data.desc || '').trim(),
    status: data.status || 'pending',
    priority: data.priority || 'medium',
    category: data.category || 'other',
    tags: data.tags || [],
    subtasks: data.subtasks || [],
    dueDate: data.dueDate || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ===== FILTERING & SORTING =====
function getFilteredTasks() {
  let tasks = [...APP.tasks];
  if (APP.filter.search) {
    const q = APP.filter.search.toLowerCase();
    tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.tags.some(g => g.toLowerCase().includes(q)));
  }
  if (APP.filter.status !== 'all') {
    tasks = APP.filter.status === 'urgent' ? tasks.filter(t => t.priority === 'urgent') : tasks.filter(t => t.status === APP.filter.status);
  }
  if (APP.filter.category !== 'all') tasks = tasks.filter(t => t.category === APP.filter.category);
  const [field, dir] = APP.sort.split('-');
  tasks.sort((a, b) => {
    let va = a[field], vb = b[field];
    if (field === 'priority') { const o = {urgent:4,high:3,medium:2,low:1}; va = o[va]||0; vb = o[vb]||0; }
    if (field === 'dueDate') { va = va ? new Date(va).getTime() : Infinity; vb = vb ? new Date(vb).getTime() : Infinity; }
    if (field === 'title') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    return va < vb ? (dir==='asc'?-1:1) : va > vb ? (dir==='asc'?1:-1) : 0;
  });
  return tasks;
}

function getStats() {
  return {
    all: APP.tasks.length,
    pending: APP.tasks.filter(t => t.status==='pending').length,
    inprogress: APP.tasks.filter(t => t.status==='inprogress').length,
    done: APP.tasks.filter(t => t.status==='done').length,
    urgent: APP.tasks.filter(t => t.priority==='urgent').length,
  };
}

// ===== RENDER =====
function renderApp() { updateStats(); renderTaskList(); updateProgress(); }

function updateStats() {
  const s = getStats();
  ['All','Pending','InProgress','Done','Urgent'].forEach(k => {
    const el = document.getElementById('stat'+k);
    if (el) el.textContent = s[k.toLowerCase()];
  });
  document.getElementById('taskCount').textContent =
    s.all === 0 ? 'لا توجد مهام' : `${s.all} مهمة · ${s.done} منجزة`;
}

function updateProgress() {
  const total = APP.tasks.length, done = APP.tasks.filter(t => t.status==='done').length;
  const pct = total === 0 ? 0 : Math.round(done/total*100);
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressPct').textContent = pct + '%';
}

function renderTaskList() {
  const list = document.getElementById('taskList'), empty = document.getElementById('emptyState');
  const tasks = getFilteredTasks();
  if (!tasks.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    document.getElementById('emptyTitle').textContent = APP.filter.search ? 'لا توجد نتائج' : 'لا توجد مهام بعد';
    document.getElementById('emptyMsg').textContent = APP.filter.search ? `لم يتم العثور على "${APP.filter.search}"` : 'اضغط على + لإضافة أول مهمة لك';
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = tasks.map(renderTaskCard).join('');
  list.querySelectorAll('.task-card').forEach(c => c.addEventListener('click', e => { if (!e.target.closest('.task-check')) openDetail(c.dataset.id); }));
  list.querySelectorAll('.task-check').forEach(c => c.addEventListener('click', e => { e.stopPropagation(); toggleTaskDone(c.dataset.id); }));
}

function renderTaskCard(t, i) {
  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
  const sl = {pending:'⏳ معلقة',inprogress:'🔄 جارية',done:'✅ منجزة'};
  const pl = {low:'منخفضة',medium:'متوسطة',high:'عالية',urgent:'🔥 عاجلة'};
  const sDone = t.subtasks.filter(s=>s.done).length, sTotal = t.subtasks.length;
  const sPct = sTotal > 0 ? Math.round(sDone/sTotal*100) : 0;
  const tagsHtml = t.tags.length ? `<div class="task-tags">${t.tags.slice(0,3).map(g=>`<span class="tag-chip">${escHtml(g)}</span>`).join('')}${t.tags.length>3?`<span class="tag-chip">+${t.tags.length-3}</span>`:''}</div>` : '';
  return `<div class="task-card priority-${t.priority} status-${t.status}" data-id="${t.id}" style="animation-delay:${i*0.05}s">
    <div class="task-card-header">
      <div class="task-check ${t.status==='done'?'checked':''}" data-id="${t.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="task-content">
        <div class="task-title">${escHtml(t.title)}</div>
        ${t.desc?`<div class="task-desc">${escHtml(t.desc)}</div>`:''}
        <div class="task-meta">
          <span class="task-badge badge-status-${t.status}">${sl[t.status]}</span>
          <span class="task-badge badge-priority-${t.priority}">${pl[t.priority]}</span>
          ${t.dueDate?`<span class="task-due ${overdue?'overdue':''}">${overdue?'⚠ ':''}${formatDate(t.dueDate)}</span>`:''}
        </div>
        ${tagsHtml}
        ${sTotal>0?`<div class="task-subtask-progress"><div class="subtask-progress-bar"><div class="subtask-progress-fill" style="width:${sPct}%"></div></div><div class="subtask-progress-label">${sDone}/${sTotal} مهمة فرعية</div></div>`:''}
      </div>
    </div>
  </div>`;
}

function toggleTaskDone(id) {
  const t = APP.tasks.find(t=>t.id===id); if (!t) return;
  t.status = t.status==='done'?'pending':'done'; t.updatedAt = Date.now();
  saveTasks(); renderApp();
  showToast(t.status==='done'?'✅ تم إنجاز المهمة!':'↩️ تم إلغاء الإنجاز', t.status==='done'?'success':'info');
}

// ===== MODAL ADD/EDIT =====
function openAddModal() {
  APP.editingId=null; APP.currentTags=[]; APP.currentSubtasks=[];
  document.getElementById('modalTitle').textContent='إضافة مهمة جديدة';
  ['taskTitle','taskDesc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('taskStatus').value='pending';
  document.getElementById('taskCategory').value='work';
  document.getElementById('taskDueDate').value='';
  document.getElementById('tagsList').innerHTML='';
  document.getElementById('subtaskList').innerHTML='';
  document.getElementById('titleCount').textContent='0/100';
  document.getElementById('descCount').textContent='0/500';
  document.querySelectorAll('.priority-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('[data-priority="medium"]').classList.add('active');
  showModal('taskModal');
  setTimeout(()=>document.getElementById('taskTitle').focus(),300);
}

function openEditModal(id) {
  const t = APP.tasks.find(t=>t.id===id); if (!t) return;
  APP.editingId=id; APP.currentTags=[...t.tags]; APP.currentSubtasks=t.subtasks.map(s=>({...s}));
  document.getElementById('modalTitle').textContent='تعديل المهمة';
  document.getElementById('taskTitle').value=t.title;
  document.getElementById('taskDesc').value=t.desc||'';
  document.getElementById('taskStatus').value=t.status;
  document.getElementById('taskCategory').value=t.category;
  document.getElementById('taskDueDate').value=t.dueDate||'';
  document.getElementById('titleCount').textContent=t.title.length+'/100';
  document.getElementById('descCount').textContent=(t.desc||'').length+'/500';
  document.querySelectorAll('.priority-btn').forEach(b=>b.classList.toggle('active',b.dataset.priority===t.priority));
  renderTagsList(); renderSubtaskList();
  showModal('taskModal');
  setTimeout(()=>document.getElementById('taskTitle').focus(),300);
}

function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { showToast('⚠️ يرجى كتابة عنوان المهمة','error'); document.getElementById('taskTitle').focus(); return; }
  const data = {
    title, desc: document.getElementById('taskDesc').value,
    status: document.getElementById('taskStatus').value,
    priority: (document.querySelector('.priority-btn.active')||{}).dataset?.priority||'medium',
    category: document.getElementById('taskCategory').value,
    dueDate: document.getElementById('taskDueDate').value,
    tags: [...APP.currentTags], subtasks: APP.currentSubtasks.map(s=>({...s})),
  };
  if (APP.editingId) {
    const idx = APP.tasks.findIndex(t=>t.id===APP.editingId);
    if (idx!==-1) { APP.tasks[idx]={...APP.tasks[idx],...data,updatedAt:Date.now()}; showToast('✏️ تم تعديل المهمة','success'); }
  } else {
    APP.tasks.unshift(createTask(data)); showToast('✅ تمت إضافة المهمة','success');
  }
  saveTasks(); hideModal('taskModal'); renderApp();
}

// ===== DETAIL =====
function openDetail(id) {
  const t = APP.tasks.find(t=>t.id===id); if (!t) return;
  APP.detailId=id;
  const sl={pending:'⏳ معلقة',inprogress:'🔄 جارية',done:'✅ منجزة'};
  const pl={low:'🟢 منخفضة',medium:'🔵 متوسطة',high:'🟡 عالية',urgent:'🔴 عاجلة'};
  const cl={work:'💼 عمل',personal:'🏠 شخصي',study:'📚 دراسة',health:'❤️ صحة',finance:'💰 مالية',other:'⭐ أخرى'};
  const overdue = t.dueDate && new Date(t.dueDate)<new Date() && t.status!=='done';
  const subsHtml = t.subtasks.length ? `<div class="detail-section"><div class="detail-label">المهام الفرعية</div><div class="detail-subtasks">${t.subtasks.map(s=>`<div class="subtask-item"><div class="subtask-check ${s.done?'checked':''}" data-subtask-id="${s.id}" data-task-id="${t.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg></div><span class="subtask-item-text ${s.done?'done':''}">${escHtml(s.text)}</span></div>`).join('')}</div></div>` : '';
  document.getElementById('detailBody').innerHTML = `
    <div class="detail-section"><div class="detail-label">العنوان</div><div class="detail-value" style="font-size:1.1rem;font-weight:800">${escHtml(t.title)}</div></div>
    ${t.desc?`<div class="detail-section"><div class="detail-label">الوصف</div><div class="detail-value">${escHtml(t.desc)}</div></div>`:''}
    <div class="detail-row">
      <div class="detail-section"><div class="detail-label">الحالة</div><div class="detail-badges"><span class="task-badge badge-status-${t.status}">${sl[t.status]}</span></div></div>
      <div class="detail-section"><div class="detail-label">الأولوية</div><div class="detail-badges"><span class="task-badge badge-priority-${t.priority}">${pl[t.priority]}</span></div></div>
    </div>
    <div class="detail-row">
      <div class="detail-section"><div class="detail-label">التصنيف</div><div class="detail-value">${cl[t.category]||t.category}</div></div>
      ${t.dueDate?`<div class="detail-section"><div class="detail-label">الاستحقاق</div><div class="detail-value ${overdue?'overdue':''}">${overdue?'⚠ ':''}${formatDate(t.dueDate)}</div></div>`:''}
    </div>
    ${t.tags.length?`<div class="detail-section"><div class="detail-label">الوسوم</div><div class="detail-tags">${t.tags.map(g=>`<span class="detail-tag">${escHtml(g)}</span>`).join('')}</div></div>`:''}
    ${subsHtml}
    <div class="detail-section"><div class="detail-label">التواريخ</div><div class="detail-value" style="font-size:0.78rem;color:var(--text-muted)">أُنشئت: ${formatDateTime(t.createdAt)} · آخر تعديل: ${formatDateTime(t.updatedAt)}</div></div>`;
  document.querySelectorAll('.subtask-check[data-subtask-id]').forEach(el => el.addEventListener('click', ()=>toggleSubtaskInDetail(el.dataset.taskId,el.dataset.subtaskId)));
  showModal('detailModal');
}

function toggleSubtaskInDetail(taskId, subtaskId) {
  const t=APP.tasks.find(t=>t.id===taskId); if(!t) return;
  const s=t.subtasks.find(s=>s.id===subtaskId); if(!s) return;
  s.done=!s.done; t.updatedAt=Date.now(); saveTasks(); renderApp(); openDetail(taskId);
}

function deleteTask(id) {
  confirmDialog('🗑️','حذف المهمة','هل أنت متأكد من حذف هذه المهمة؟',()=>{
    APP.tasks=APP.tasks.filter(t=>t.id!==id); saveTasks(); hideModal('detailModal'); renderApp(); showToast('🗑️ تم حذف المهمة','info');
  });
}

// ===== TAGS & SUBTASKS =====
function renderTagsList() {
  document.getElementById('tagsList').innerHTML = APP.currentTags.map(tag=>`<div class="tag-item"><button onclick="removeTag('${escHtml(tag)}')" title="حذف">×</button>${escHtml(tag)}</div>`).join('');
}
function addTag(tag) { tag=tag.trim().toLowerCase(); if(!tag||APP.currentTags.includes(tag)||APP.currentTags.length>=5) return; APP.currentTags.push(tag); renderTagsList(); }
function removeTag(tag) { APP.currentTags=APP.currentTags.filter(t=>t!==tag); renderTagsList(); }

function renderSubtaskList() {
  document.getElementById('subtaskList').innerHTML = APP.currentSubtasks.map(s=>`<div class="subtask-item"><div class="subtask-check ${s.done?'checked':''}" onclick="toggleSubtaskInModal('${s.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg></div><span class="subtask-item-text ${s.done?'done':''}">${escHtml(s.text)}</span><button class="subtask-delete" onclick="removeSubtask('${s.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>`).join('');
}
function addSubtask(text) { text=text.trim(); if(!text) return; APP.currentSubtasks.push({id:generateId(),text,done:false}); renderSubtaskList(); }
function removeSubtask(id) { APP.currentSubtasks=APP.currentSubtasks.filter(s=>s.id!==id); renderSubtaskList(); }
function toggleSubtaskInModal(id) { const s=APP.currentSubtasks.find(s=>s.id===id); if(s) s.done=!s.done; renderSubtaskList(); }

// ===== EXPORT JSON =====
function exportJSON() {
  const data = { _type:'taskflow_export', _source:'HoloolFlow — حلول فلو', _watermark:'Generated by Task Flow © 2026 HoloolFlow', exportedAt:new Date().toISOString(), taskCount:APP.tasks.length, tasks:APP.tasks };
  downloadFile(JSON.stringify(data,null,2), `taskflow-export-${dateStamp()}.json`, 'application/json');
  showToast('📤 تم تصدير المهام (JSON)','success');
}

// ===== EXPORT CSV (Arabic fixed with BOM) =====
function exportCSV() {
  const sAr={pending:'معلقة',inprogress:'جارية',done:'منجزة'};
  const pAr={low:'منخفضة',medium:'متوسطة',high:'عالية',urgent:'عاجلة'};
  const cAr={work:'عمل',personal:'شخصي',study:'دراسة',health:'صحة',finance:'مالية',other:'أخرى'};
  const headers = ['العنوان','الوصف','الحالة','الأولوية','التصنيف','تاريخ الاستحقاق','الوسوم','تاريخ الإنشاء'];
  const rows = APP.tasks.map(t=>[t.title,t.desc||'',sAr[t.status]||t.status,pAr[t.priority]||t.priority,cAr[t.category]||t.category,t.dueDate||'',t.tags.join(' | '),new Date(t.createdAt).toLocaleDateString('ar-EG')].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
  const bom = '\uFEFF';
  downloadFile(bom+[headers.join(','),...rows].join('\r\n'), `taskflow-${dateStamp()}.csv`, 'text/csv;charset=utf-8;');
  showToast('📊 تم تصدير CSV — يدعم العربية','success');
}

// ===== IMPORT CSV =====
function importCSV(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      let text = e.target.result;
      if (text.charCodeAt(0)===0xFEFF) text=text.slice(1);
      const lines = text.split(/\r?\n/).filter(l=>l.trim());
      if (lines.length<2) throw new Error('الملف فارغ');
      const sMap={معلقة:'pending',جارية:'inprogress',منجزة:'done',pending:'pending',inprogress:'inprogress',done:'done'};
      const pMap={منخفضة:'low',متوسطة:'medium',عالية:'high',عاجلة:'urgent',low:'low',medium:'medium',high:'high',urgent:'urgent'};
      const cMap={عمل:'work',شخصي:'personal',دراسة:'study',صحة:'health',مالية:'finance',أخرى:'other',work:'work',personal:'personal',study:'study',health:'health',finance:'finance',other:'other'};
      const tasks = [];
      for (let i=1;i<lines.length;i++) {
        const cols=parseCSVLine(lines[i]);
        if (!cols[0]) continue;
        tasks.push(createTask({ title:cols[0]||'مهمة', desc:cols[1]||'', status:sMap[cols[2]]||'pending', priority:pMap[cols[3]]||'medium', category:cMap[cols[4]]||'other', dueDate:cols[5]||'', tags:cols[6]?cols[6].split('|').map(t=>t.trim()).filter(Boolean):[], subtasks:[] }));
      }
      if (!tasks.length) throw new Error('لم يتم العثور على مهام');
      confirmDialog('📥','استيراد CSV',`تم العثور على ${tasks.length} مهمة. هل تريد إضافتها؟`,()=>{
        APP.tasks=[...APP.tasks,...tasks]; saveTasks(); renderApp(); showToast(`✅ تم استيراد ${tasks.length} مهمة من CSV`,'success');
      });
    } catch(err) { showToast('❌ خطأ في CSV: '+err.message,'error'); }
  };
  reader.readAsText(file,'UTF-8');
}

function parseCSVLine(line) {
  const r=[];let cur='',inQ=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}else if(c===','&&!inQ){r.push(cur);cur='';}else cur+=c;}
  r.push(cur); return r;
}

// ===== EXPORT EXCEL =====
function exportExcel() {
  if (typeof XLSX==='undefined'){showToast('❌ مكتبة Excel غير محملة، تحقق من الاتصال','error');return;}
  const sAr={pending:'معلقة',inprogress:'جارية',done:'منجزة'};
  const pAr={low:'منخفضة',medium:'متوسطة',high:'عالية',urgent:'عاجلة'};
  const cAr={work:'عمل',personal:'شخصي',study:'دراسة',health:'صحة',finance:'مالية',other:'أخرى'};
  const data=[
    ['العنوان','الوصف','الحالة','الأولوية','التصنيف','تاريخ الاستحقاق','الوسوم','المهام الفرعية','تاريخ الإنشاء'],
    ...APP.tasks.map(t=>[t.title,t.desc||'',sAr[t.status]||t.status,pAr[t.priority]||t.priority,cAr[t.category]||t.category,t.dueDate||'',t.tags.join(' | '),t.subtasks.map(s=>(s.done?'✓ ':'○ ')+s.text).join(' | '),new Date(t.createdAt).toLocaleDateString('ar-EG')])
  ];
  const ws=XLSX.utils.aoa_to_sheet(data);
  ws['!cols']=[{wch:30},{wch:40},{wch:10},{wch:10},{wch:10},{wch:15},{wch:25},{wch:35},{wch:18}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'المهام');
  const wsInfo=XLSX.utils.aoa_to_sheet([['Task Flow — HoloolFlow حلول فلو'],['© 2026 جميع الحقوق محفوظة'],['تاريخ التصدير',new Date().toLocaleString('ar-EG')],['عدد المهام',APP.tasks.length]]);
  XLSX.utils.book_append_sheet(wb,wsInfo,'معلومات');
  XLSX.writeFile(wb,`taskflow-${dateStamp()}.xlsx`);
  showToast('📗 تم تصدير Excel بنجاح','success');
}

// ===== IMPORT EXCEL =====
function importExcel(file) {
  if (!file) return;
  if (typeof XLSX==='undefined'){showToast('❌ مكتبة Excel غير محملة','error');return;}
  const reader=new FileReader();
  reader.onload=(e)=>{
    try {
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
      if(rows.length<2) throw new Error('لا توجد بيانات');
      const sMap={معلقة:'pending',جارية:'inprogress',منجزة:'done'};
      const pMap={منخفضة:'low',متوسطة:'medium',عالية:'high',عاجلة:'urgent'};
      const cMap={عمل:'work',شخصي:'personal',دراسة:'study',صحة:'health',مالية:'finance',أخرى:'other'};
      const tasks=[];
      for(let i=1;i<rows.length;i++){
        const r=rows[i]; if(!r[0]) continue;
        tasks.push(createTask({title:String(r[0]||'مهمة'),desc:String(r[1]||''),status:sMap[r[2]]||'pending',priority:pMap[r[3]]||'medium',category:cMap[r[4]]||'other',dueDate:r[5]?String(r[5]):'',tags:r[6]?String(r[6]).split('|').map(t=>t.trim()).filter(Boolean):[],subtasks:[]}));
      }
      if(!tasks.length) throw new Error('لم يتم العثور على مهام');
      confirmDialog('📗','استيراد Excel',`تم العثور على ${tasks.length} مهمة. هل تريد إضافتها؟`,()=>{
        APP.tasks=[...APP.tasks,...tasks]; saveTasks(); renderApp(); showToast(`✅ تم استيراد ${tasks.length} مهمة من Excel`,'success');
      });
    } catch(err){showToast('❌ خطأ في Excel: '+err.message,'error');}
  };
  reader.readAsArrayBuffer(file);
}

// ===== IMPORT JSON =====
function importJSON(file) {
  if (!file) return;
  const reader=new FileReader();
  reader.onload=(e)=>{
    try {
      const data=JSON.parse(e.target.result);
      const imported=data.tasks||data;
      if(!Array.isArray(imported)) throw new Error('صيغة غير صحيحة');
      confirmDialog('📥','استيراد JSON',`سيتم إضافة ${imported.length} مهمة. هل تريد المتابعة؟`,()=>{
        const newTasks=imported.filter(t=>t.id&&t.title&&!APP.tasks.find(e=>e.id===t.id));
        APP.tasks=[...APP.tasks,...newTasks]; saveTasks(); renderApp(); showToast(`✅ تم استيراد ${newTasks.length} مهمة`,'success');
      });
    } catch(e){showToast('❌ الملف غير صالح','error');}
  };
  reader.readAsText(file);
}

// ===== BACKUP (full, distinct from export) =====
function createBackup() {
  const data={
    _type:'taskflow_backup',
    _source:'HoloolFlow — حلول فلو',
    _watermark:'Task Flow Backup © 2026 HoloolFlow. All rights reserved.',
    version:'1.1', backedUpAt:new Date().toISOString(),
    deviceInfo:navigator.userAgent, taskCount:APP.tasks.length,
    tasks:APP.tasks, settings:{theme:APP.theme}, stats:getStats(),
  };
  downloadFile(JSON.stringify(data,null,2), `taskflow-BACKUP-${dateStamp()}.json`, 'application/json');
  showToast('💾 نسخة احتياطية كاملة تم إنشاؤها','success');
}

function restoreBackup(file) {
  if (!file) return;
  const reader=new FileReader();
  reader.onload=(e)=>{
    try {
      const data=JSON.parse(e.target.result);
      if(!data.tasks||!Array.isArray(data.tasks)) throw new Error('صيغة غير صحيحة');
      confirmDialog('♻️','استعادة النسخة الاحتياطية',`سيتم استبدال جميع المهام الحالية بـ ${data.tasks.length} مهمة. هل أنت متأكد؟`,()=>{
        APP.tasks=data.tasks;
        if(data.settings?.theme){APP.theme=data.settings.theme;applyTheme();}
        saveTasks(); saveSettings(); renderApp(); showToast('✅ تمت الاستعادة بنجاح','success');
      });
    } catch(e){showToast('❌ ملف النسخة الاحتياطية غير صالح','error');}
  };
  reader.readAsText(file);
}

function clearAll() {
  confirmDialog('🗑️','مسح كل المهام',`سيتم حذف ${APP.tasks.length} مهمة نهائياً. هل أنت متأكد تماماً؟`,()=>{
    APP.tasks=[]; saveTasks(); hideMenu(); renderApp(); showToast('🗑️ تم مسح جميع المهام','info');
  });
}

// ===== THEME =====
function applyTheme() {
  document.body.classList.toggle('dark-mode', APP.theme==='dark');
  document.body.classList.toggle('light-mode', APP.theme==='light');
  document.getElementById('moonIcon').style.display = APP.theme==='dark'?'block':'none';
  document.getElementById('sunIcon').style.display = APP.theme==='light'?'block':'none';
  document.querySelector('meta[name="theme-color"]').content = APP.theme==='dark'?'#0F0F14':'#F4F4F8';
}
function toggleTheme() {
  APP.theme = APP.theme==='dark'?'light':'dark';
  applyTheme(); saveSettings();
  showToast(APP.theme==='dark'?'🌙 الوضع الداكن':'☀️ الوضع الفاتح','info');
}

// ===== MODALS =====
function showModal(id){document.getElementById(id).classList.remove('hidden');document.body.style.overflow='hidden';}
function hideModal(id){document.getElementById(id).classList.add('hidden');document.body.style.overflow='';APP.editingId=null;APP.detailId=null;}
function showMenu(){document.getElementById('sideMenu').classList.remove('hidden');document.body.style.overflow='hidden';}
function hideMenu(){document.getElementById('sideMenu').classList.add('hidden');document.body.style.overflow='';}

// ===== CONFIRM =====
let confirmCallback=null;
function confirmDialog(icon,title,msg,cb){
  document.getElementById('confirmIcon').textContent=icon;
  document.getElementById('confirmTitle').textContent=title;
  document.getElementById('confirmMsg').textContent=msg;
  confirmCallback=cb; showModal('confirmOverlay');
}

// ===== TOAST =====
function showToast(msg,type='info'){
  const icons={success:'✅',error:'❌',info:'ℹ️'};
  const t=document.createElement('div'); t.className=`toast ${type}`;
  t.innerHTML=`<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(()=>{t.classList.add('hide');setTimeout(()=>t.remove(),300);},3200);
}

// ===== INSTALL (Smart: Android auto + iOS guide) =====
function detectOS() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

function isRunningAsPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function initInstallPrompt() {
  const os = detectOS();
  const btnText = document.getElementById('installBtnText');

  // Update button text based on OS
  if (isRunningAsPWA()) {
    // Already installed — hide install section
    const ms = document.getElementById('menuInstallSection');
    if (ms) ms.style.display = 'none';
    return;
  }

  if (os === 'ios') {
    if (btnText) btnText.textContent = 'تثبيت على iPhone / iPad';
  } else if (os === 'android') {
    if (btnText) btnText.textContent = 'تثبيت على Android';
  } else {
    if (btnText) btnText.textContent = 'تثبيت التطبيق على جهازك';
  }

  // Capture Android/Desktop install event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    APP.deferredInstall = e;
    if (!localStorage.getItem('install_dismissed')) {
      setTimeout(() => document.getElementById('installPrompt').classList.remove('hidden'), 5000);
    }
  });

  // Floating prompt button
  document.getElementById('installBtn').addEventListener('click', triggerInstall);

  // Menu button
  const mib = document.getElementById('menuInstallBtn');
  if (mib) mib.addEventListener('click', () => { hideMenu(); setTimeout(triggerInstall, 300); });

  // Dismiss floating prompt
  document.getElementById('installDismiss').addEventListener('click', () => {
    document.getElementById('installPrompt').classList.add('hidden');
    localStorage.setItem('install_dismissed', '1');
  });

  // iOS guide close
  const iosClose = document.getElementById('closeIosGuide');
  if (iosClose) iosClose.addEventListener('click', () => hideModal('iosInstallModal'));
  const iosModal = document.getElementById('iosInstallModal');
  if (iosModal) iosModal.addEventListener('click', e => { if (e.target === e.currentTarget) hideModal('iosInstallModal'); });

  window.addEventListener('appinstalled', () => {
    document.getElementById('installPrompt').classList.add('hidden');
    const ms = document.getElementById('menuInstallSection');
    if (ms) ms.style.display = 'none';
    showToast('🎉 Task Flow مثبت الآن!', 'success');
  });
}

async function triggerInstall() {
  const os = detectOS();

  if (isRunningAsPWA()) {
    showToast('✅ التطبيق مثبت بالفعل على جهازك', 'success');
    return;
  }

  if (os === 'ios') {
    // iOS: show manual guide
    showModal('iosInstallModal');
    return;
  }

  // Android / Desktop: use browser prompt
  if (APP.deferredInstall) {
    document.getElementById('installPrompt').classList.add('hidden');
    APP.deferredInstall.prompt();
    const r = await APP.deferredInstall.userChoice;
    if (r.outcome === 'accepted') showToast('🎉 تم تثبيت التطبيق بنجاح!', 'success');
    APP.deferredInstall = null;
    const ms = document.getElementById('menuInstallSection');
    if (ms) ms.style.display = 'none';
  } else {
    // Prompt not available — show generic guide
    showToast('افتح قائمة المتصفح ← "إضافة إلى الشاشة الرئيسية"', 'info');
  }
}

function registerSW() {
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').then(r=>{
      r.addEventListener('updatefound',()=>{
        const nw=r.installing;
        nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)showToast('🔄 تحديث جديد متاح!','info');});
      });
    }).catch(()=>{});
  }
}

// ===== UTILS =====
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function formatDate(d){if(!d)return'';return new Date(d+'T00:00:00').toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'});}
function formatDateTime(ts){return new Date(ts).toLocaleString('ar-EG',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function dateStamp(){return new Date().toISOString().slice(0,10);}
function downloadFile(content,name,type){const b=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();URL.revokeObjectURL(a.href);}

// ===== INIT =====
function init() {
  loadSettings(); loadTasks(); applyTheme(); initInstallPrompt(); registerSW();
  document.querySelector('.loader-fill').addEventListener('animationend',()=>{
    setTimeout(()=>{
      const sp=document.getElementById('splash'); sp.style.opacity='0'; sp.style.transition='opacity 0.5s ease';
      setTimeout(()=>{ sp.classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); renderApp(); },500);
    },200);
  });
  document.getElementById('addTaskBtn').addEventListener('click',openAddModal);
  document.getElementById('saveTask').addEventListener('click',saveTask);
  document.getElementById('closeModal').addEventListener('click',()=>hideModal('taskModal'));
  document.getElementById('cancelModal').addEventListener('click',()=>hideModal('taskModal'));
  document.getElementById('closeDetail').addEventListener('click',()=>hideModal('detailModal'));
  document.getElementById('taskModal').addEventListener('click',e=>{if(e.target===e.currentTarget)hideModal('taskModal');});
  document.getElementById('detailModal').addEventListener('click',e=>{if(e.target===e.currentTarget)hideModal('detailModal');});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){hideModal('taskModal');hideModal('detailModal');hideModal('confirmOverlay');hideMenu();}
    if(e.key==='Enter'&&!document.getElementById('taskModal').classList.contains('hidden')){const a=document.activeElement;if(a.tagName!=='TEXTAREA'&&a.tagName!=='SELECT')saveTask();}
  });
  document.getElementById('editTaskBtn').addEventListener('click',()=>{const id=APP.detailId;hideModal('detailModal');openEditModal(id);});
  document.getElementById('deleteTaskBtn').addEventListener('click',()=>deleteTask(APP.detailId));
  document.getElementById('themeToggle').addEventListener('click',toggleTheme);
  document.getElementById('menuBtn').addEventListener('click',showMenu);
  document.getElementById('closeMenu').addEventListener('click',hideMenu);
  document.getElementById('menuBackdrop').addEventListener('click',hideMenu);
  document.getElementById('searchToggle').addEventListener('click',()=>{
    const bar=document.getElementById('searchBar'); bar.classList.toggle('hidden');
    if(!bar.classList.contains('hidden'))document.getElementById('searchInput').focus();
    else{document.getElementById('searchInput').value='';APP.filter.search='';renderApp();}
  });
  document.getElementById('searchInput').addEventListener('input',e=>{APP.filter.search=e.target.value;document.getElementById('clearSearch').classList.toggle('hidden',!e.target.value);renderApp();});
  document.getElementById('clearSearch').addEventListener('click',()=>{document.getElementById('searchInput').value='';APP.filter.search='';document.getElementById('clearSearch').classList.add('hidden');renderApp();});
  document.querySelectorAll('.stat-chip').forEach(c=>c.addEventListener('click',()=>{document.querySelectorAll('.stat-chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');APP.filter.status=c.dataset.filter;renderApp();}));
  document.querySelectorAll('.filter-tag').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter-tag').forEach(x=>x.classList.remove('active'));b.classList.add('active');APP.filter.category=b.dataset.cat;renderApp();}));
  document.getElementById('sortSelect').addEventListener('change',e=>{APP.sort=e.target.value;renderApp();});
  document.querySelectorAll('.priority-btn').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.priority-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');}));
  document.getElementById('tagInput').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addTag(e.target.value);e.target.value='';}});
  document.getElementById('subtaskInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addSubtask(e.target.value);e.target.value='';}});
  document.getElementById('addSubtask').addEventListener('click',()=>{const i=document.getElementById('subtaskInput');addSubtask(i.value);i.value='';i.focus();});
  document.getElementById('taskTitle').addEventListener('input',e=>{document.getElementById('titleCount').textContent=e.target.value.length+'/100';});
  document.getElementById('taskDesc').addEventListener('input',e=>{document.getElementById('descCount').textContent=e.target.value.length+'/500';});
  document.getElementById('confirmYes').addEventListener('click',()=>{hideModal('confirmOverlay');if(confirmCallback){confirmCallback();confirmCallback=null;}});
  document.getElementById('confirmNo').addEventListener('click',()=>{hideModal('confirmOverlay');confirmCallback=null;});
  document.getElementById('confirmOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget){hideModal('confirmOverlay');confirmCallback=null;}});
  document.getElementById('exportBtn').addEventListener('click',()=>{exportJSON();hideMenu();});
  document.getElementById('exportCsvBtn').addEventListener('click',()=>{exportCSV();hideMenu();});
  document.getElementById('exportExcelBtn').addEventListener('click',()=>{exportExcel();hideMenu();});
  document.getElementById('importFile').addEventListener('change',e=>{importJSON(e.target.files[0]);e.target.value='';});
  document.getElementById('importCsvFile').addEventListener('change',e=>{importCSV(e.target.files[0]);e.target.value='';});
  document.getElementById('importExcelFile').addEventListener('change',e=>{importExcel(e.target.files[0]);e.target.value='';});
  document.getElementById('backupBtn').addEventListener('click',()=>{createBackup();hideMenu();});
  document.getElementById('restoreFile').addEventListener('change',e=>{restoreBackup(e.target.files[0]);e.target.value='';});
  document.getElementById('clearAllBtn').addEventListener('click',clearAll);
}

document.addEventListener('DOMContentLoaded',init);