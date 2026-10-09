/* The renderer owns presentation only. Every data change is committed by the main process. */
const api=window.forToday;
const $=(selector)=>document.querySelector(selector);
const escapeHtml=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={
  plus:'<path d="M12 5v14M5 12h14"/>',back:'<path d="m14 5-7 7 7 7"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  enter:'<path d="M19 5v8H5m5-5-5 5 5 5"/>',edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  backup:'<path d="M4 10a8 8 0 1 1 0 5M4 4v6h6M12 7v5l3 2"/>',folder:'<path d="M3 6h7l2 3h9v11H3V6Z"/>',check:'<path d="m5 12 4 4L19 6"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.more}</svg>`;
const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const nextDay=()=>{const d=new Date();d.setDate(d.getDate()+1);return localDate(d);};
const dateObject=value=>new Date(`${value}T12:00:00`);
const dateFormat=(value,options)=>dateObject(value).toLocaleDateString('de-DE',options);
const fullDate=value=>dateFormat(value,{weekday:'long',day:'2-digit',month:'long'});
const duration=minutes=>minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} h${minutes%60?' '+minutes%60+' min':''}`;
let state={version:1,lists:[]},activeId=null,busy=false,lastDay=localDate(),toastTimer;
let appVersion='',settingsState=null;
let draft={text:'',duration:'',unit:'min',expanded:false};
let listForm={mode:'day',date:localDate(),title:'',editing:null};
let editingTask=null;
const activeList=()=>state.lists.find(l=>l.id===activeId);
function label(list,punctuation=false) {
  if(!list.date)return list.title;
  if(list.date===localDate())return 'Heute'+(punctuation?'.':'');
  if(list.date===nextDay())return 'Morgen'+(punctuation?'.':'');
  return dateFormat(list.date,{day:'2-digit',month:'short',year:'numeric'});
}
function flash(message,undo=false) {
  ($('#sheet').open?$('#sheet'):document.body).append($('#toast'));
  clearTimeout(toastTimer);$('#toast').hidden=false;$('#toast').innerHTML=`<span>${escapeHtml(message)}</span>${undo?'<button data-action="undo">Rückgängig</button>':''}`;
  toastTimer=setTimeout(()=>{$('#toast').hidden=true;},undo?8000:5000);
}
function error(message) {
  const target=$('#sheet').open?$('#sheet-error'):$('#inline-error');
  if(target){target.textContent=message;target.hidden=false;}else flash(message);
}
function clearError(){document.querySelectorAll('.form-error').forEach(e=>{e.hidden=true;e.textContent='';});}
function captureDraft(){if($('#task-input')){draft.text=$('#task-input').value;if($('#add-duration')){draft.duration=$('#add-duration').value;draft.unit=$('#add-unit').value;}}}
async function change(action,{rerender=true}={}) {
  if(busy)return false;busy=true;clearError();captureDraft();
  try{state=await api.action(action);$('#toast').hidden=true;if(activeId&&!activeList())activeId=null;if(rerender)render();return true;}
  catch(e){error(e.message);return false;}finally{busy=false;}
}
function previews(list){return list.tasks.slice(0,3).map(task=>`<div class="preview ${task.done?'checked':''}"><span class="mini-check">${task.done?'✓':''}</span><span>${escapeHtml(task.text)}</span></div>`).join('');}
function card(list) {
  const done=list.tasks.filter(t=>t.done).length,today=list.date===localDate();
  const remaining=list.tasks.filter(t=>!t.done).reduce((sum,t)=>sum+(t.minutes||0),0);
  return `<button class="list-card ${today?'today':''}" data-action="open-list" data-id="${escapeHtml(list.id)}" aria-label="${escapeHtml(label(list))} öffnen">
    <div class="card-top"><span class="card-title">${escapeHtml(label(list))}</span><span class="card-arrow">↗</span></div>
    <div class="card-meta">${list.tasks.length?`${done} / ${list.tasks.length} erledigt`:'Noch keine Aufgaben'}${remaining?' · '+duration(remaining):''}</div>
    ${list.tasks.length?`<div class="card-previews">${previews(list)}</div>`:''}
    ${today&&list.tasks.length?`<div class="card-progress"><progress value="${done}" max="${list.tasks.length}" aria-label="Erledigte Aufgaben"></progress></div>`:''}
  </button>`;
}
function home() {
  const today=state.lists.filter(l=>l.date===localDate());
  const upcoming=state.lists.filter(l=>l.date&&l.date>localDate()).sort((a,b)=>a.date.localeCompare(b.date));
  const named=state.lists.filter(l=>!l.date);
  const past=state.lists.filter(l=>l.date&&l.date<localDate()).sort((a,b)=>b.date.localeCompare(a.date));
  const section=(name,lists)=>lists.length?`<div class="section-label"><span>${name}</span><span>${String(lists.length).padStart(2,'0')}</span></div>${lists.map(card).join('')}`:'';
  $('#app').innerHTML=`<div class="page-top"><div class="top-line"><span class="eyebrow">EIN TAG NACH DEM ANDEREN</span><button class="icon-button" data-action="menu" aria-label="Menü" title="Menü">${icon('more')}</button></div><h1 class="page-heading">Deine Listen.</h1><p class="subtitle">${fullDate(localDate())}</p></div>
    <div class="page-scroll home-scroll">${state.lists.length?section('Heute',today)+section('Als Nächstes',upcoming)+section('Deine Themen',named)+section('Vergangene Tage',past):`<div class="empty-home"><div class="paper-symbol" aria-hidden="true"><span></span><span></span><span></span></div><h2 class="empty-title">Noch ein leeres Blatt.</h2><p class="empty-copy">Für heute, morgen oder eine Idee.<br>Fang mit deiner ersten Liste an.</p></div>`}</div>
    <div class="bottom"><p id="inline-error" class="form-error" role="alert" hidden></p><button id="new-list" class="primary" data-action="new-list">${icon('plus')}Neue Liste</button><p class="footer-note">Nur hier. Nur auf deinem Gerät.</p></div>`;
}
function taskRow(task) {
  return `<div class="task-row ${task.done?'done':''}" data-id="${escapeHtml(task.id)}"><input class="task-check" type="checkbox" data-task="${escapeHtml(task.id)}" aria-label="${escapeHtml(task.text)}" ${task.done?'checked':''}><button class="task-text" data-action="edit-task" data-id="${escapeHtml(task.id)}" aria-label="${escapeHtml(task.text)} bearbeiten"><span class="task-title">${escapeHtml(task.text)}</span>${task.minutes?`<span class="task-time">${duration(task.minutes)}</span>`:''}</button><span class="edit-hint" aria-hidden="true">${icon('edit')}</span></div>`;
}
function detail() {
  const list=activeList();const open=list.tasks.filter(t=>!t.done),done=list.tasks.filter(t=>t.done),sum=open.reduce((sum,t)=>sum+(t.minutes||0),0);
  $('#app').innerHTML=`<div class="page-top"><div class="top-line"><button class="back-button" data-action="home" aria-label="Alle Listen">${icon('back')}Alle Listen</button><button class="icon-button" data-action="list-menu" aria-label="Listenoptionen" title="Listenoptionen">${icon('more')}</button></div><h1 id="list-title" class="page-heading detail-heading">${escapeHtml(label(list,true))}</h1><p class="subtitle">${list.date?fullDate(list.date)+' '+dateObject(list.date).getFullYear():'Eine Liste ohne Datum.'}</p><div class="detail-meta"><span>${open.length} offen</span><span class="divider">/</span><span>${done.length} erledigt</span>${sum?`<span class="divider">·</span><span>${duration(sum)} geplant</span>`:''}</div></div>
    <div class="page-scroll task-scroll">${list.tasks.length?open.map(taskRow).join('')+(done.length?`<div class="completed-label">ERLEDIGT · ${String(done.length).padStart(2,'0')}</div>`+done.map(taskRow).join(''):''):`<div class="empty-tasks"><h2 class="empty-title">Was steht an?</h2><p class="empty-copy">Schreib deine erste Aufgabe unten hinein. Enter speichert sie.</p></div>`}</div>
    <div class="bottom composer-wrap"><p id="inline-error" class="form-error" role="alert" hidden></p><form id="task-form"><div class="composer"><input id="task-input" aria-label="Neue Aufgabe" placeholder="Neue Aufgabe …" maxlength="500" autocomplete="off" value="${escapeHtml(draft.text)}"><button type="submit" class="add-button" aria-label="Aufgabe hinzufügen" title="Aufgabe hinzufügen (Enter)">${icon('enter')}</button></div><div class="composer-options">${draft.expanded?`<div class="inline-duration"><input id="add-duration" aria-label="Geschätzte Dauer" inputmode="decimal" placeholder="30" value="${escapeHtml(draft.duration)}"><select id="add-unit" aria-label="Zeiteinheit"><option value="min" ${draft.unit==='min'?'selected':''}>min</option><option value="h" ${draft.unit==='h'?'selected':''}>Std.</option></select><button type="button" class="remove-duration" data-action="remove-duration" aria-label="Dauer entfernen">×</button></div>`:`<button type="button" class="duration-toggle" data-action="add-duration" aria-label="Dauer hinzufügen">${icon('clock')}Dauer hinzufügen</button>`}<span class="enter-hint">Enter ↵</span></div></form></div>`;
}
function render(){if(activeList())detail();else home();}
function showSheet(title,body) {
  $('#sheet-content').innerHTML=`<div class="sheet-head"><h2 id="sheet-title">${title}</h2><button class="icon-button" data-action="close-sheet" aria-label="Schließen">${icon('close')}</button></div>${body}<p id="sheet-error" class="form-error" role="alert" hidden></p>`;
  if(!$('#sheet').open)$('#sheet').showModal();
}
function closeSheet(){document.body.append($('#toast'));$('#sheet').close();}
function listFormSheet() {
  showSheet(listForm.editing?'Liste bearbeiten':'Neue Liste',`<form id="list-form"><div class="segmented"><button type="button" data-action="mode-day" aria-pressed="${listForm.mode==='day'}">Für einen Tag</button><button type="button" data-action="mode-title" aria-pressed="${listForm.mode==='title'}">Eigener Titel</button></div>
    ${listForm.mode==='day'?`<div class="date-shortcuts"><button type="button" data-action="date-today" class="${listForm.date===localDate()?'selected':''}">Heute</button><button type="button" data-action="date-tomorrow" class="${listForm.date===nextDay()?'selected':''}">Morgen</button></div><label class="field"><span class="field-label">Oder ein anderes Datum</span><input id="list-date" type="date" min="1900-01-01" max="9999-12-31" required value="${escapeHtml(listForm.date)}"></label><p class="sheet-description">Am jeweiligen Tag steht diese Liste ganz oben.</p>`:`<label class="field"><span class="field-label">Wie heißt deine Liste?</span><input id="list-name" placeholder="z. B. Ideen, Einkauf, ein Projekt" maxlength="120" required value="${escapeHtml(listForm.title)}" autocomplete="off"></label><p class="sheet-description">Für alles, was kein Datum braucht.</p>`}
    <div class="sheet-actions"><button class="primary" type="submit">${listForm.editing?'Speichern':'Liste anlegen'}${icon('arrow')}</button></div></form>`);
  if(listForm.mode==='title')$('#list-name').focus();
}
function captureListForm(){if($('#list-name'))listForm.title=$('#list-name').value;if($('#list-date'))listForm.date=$('#list-date').value;}
function editTask(id) {
  const task=activeList().tasks.find(t=>t.id===id);editingTask=id;
  showSheet('Aufgabe bearbeiten',`<form id="edit-task-form"><label class="field"><span class="field-label">Aufgabe</span><input id="edit-text" required maxlength="500" value="${escapeHtml(task.text)}" autocomplete="off"></label><label class="field"><span class="field-label">Geschätzte Dauer · optional</span><span class="duration-fields"><input id="edit-duration" inputmode="decimal" placeholder="Ohne Zeitangabe" value="${task.minutes||''}"><select id="edit-unit" aria-label="Zeiteinheit"><option value="min">Minuten</option><option value="h">Stunden</option></select></span></label><div class="sheet-actions"><button class="primary" type="submit">Speichern${icon('check')}</button><button type="button" class="text-button" data-action="delete-task">Aufgabe löschen</button></div></form>`);
  $('#edit-text').focus();
}
const menuAction=(action,name,svg)=>`<button class="menu-action" data-action="${action}">${icon(svg)}<span>${name}</span><span class="menu-arrow" aria-hidden="true">↗</span></button>`;
function menu(){showSheet('Alles an seinem Platz.',`<p class="sheet-description">Deine Listen werden automatisch auf diesem Gerät gespeichert.</p><div class="menu-actions">${menuAction('settings','Einstellungen','more')}${menuAction('export','JSON exportieren','download')}${menuAction('import','JSON importieren','upload')}${menuAction('backup','Backup erstellen','backup')}${menuAction('backups','Backups wiederherstellen','clock')}${menuAction('folder','Datenordner öffnen','folder')}</div><p class="menu-footnote">ForToday ${escapeHtml(appVersion)}<br>Die letzten 30 Änderungen werden automatisch gesichert. Manuelle Backups bleiben erhalten.</p><button class="text-button" data-action="quit">ForToday beenden</button>`);}
async function settingsSheet(){
  settingsState=await api.settings();
  showSheet('Einstellungen',`<p class="sheet-description">So passt ForToday in deinen Alltag.</p><div class="settings-list">
    <label class="setting-row"><span><span class="setting-name">Mit Windows starten</span><span class="setting-hint">${settingsState.autoStartAvailable?'ForToday beim Anmelden automatisch öffnen.':'In der installierten oder portablen Windows-Version verfügbar.'}</span></span><input type="checkbox" role="switch" aria-label="Mit Windows starten" data-setting="openAtLogin" ${settingsState.openAtLogin?'checked':''} ${settingsState.autoStartAvailable?'':'disabled'}></label>
    <label class="setting-row"><span><span class="setting-name">Beim Schließen ins Tray</span><span class="setting-hint">Das × blendet nur das Fenster aus. Über das Symbol neben der Uhr kannst du es wieder öffnen.</span></span><input type="checkbox" role="switch" aria-label="Beim Schließen ins Tray" data-setting="closeToTray" ${settingsState.closeToTray?'checked':''}></label>
  </div><p class="settings-note">Sind beide Optionen aktiv, startet ForToday mit Windows direkt im Hintergrund.<br><br>Vollständig beenden: Rechtsklick auf das Tray-Symbol → Beenden.</p><button class="text-button" data-action="menu">Zurück zum Menü</button>`);
}
async function backups() {
  const items=await api.backups();
  const names={'auto':'Automatische Sicherung','manual':'Manuelles Backup','before-import':'Vor einem Import','before-restore':'Vor einer Wiederherstellung'};
  showSheet('Backups',`<p class="sheet-description">Wähle einen Stand zum Wiederherstellen. Deine aktuellen Listen werden vorher gesichert.</p><div class="backup-list">${items.length?items.map(item=>`<button class="backup-item" data-action="restore" data-name="${escapeHtml(item.name)}"><strong>${new Date(item.modified).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'medium'})}</strong><span>${Object.entries(names).find(([prefix])=>item.name.startsWith(prefix+'-'))?.[1]||'Backup'}</span></button>`).join(''):'<p class="empty-copy">Noch keine Backups vorhanden.</p>'}</div><button class="text-button" data-action="menu">Zurück zum Menü</button>`);
}
async function handleClick(event) {
  const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(busy)return;
  try {
    if(action==='new-list'){listForm={mode:'day',date:localDate(),title:'',editing:null};listFormSheet();}
    else if(action==='close-sheet')closeSheet();
    else if(action==='home'){captureDraft();activeId=null;draft={text:'',duration:'',unit:'min',expanded:false};render();}
    else if(action==='open-list'){activeId=button.dataset.id;draft={text:'',duration:'',unit:'min',expanded:false};render();$('#task-input').focus();}
    else if(action==='mode-day'||action==='mode-title'){captureListForm();listForm.mode=action==='mode-day'?'day':'title';listFormSheet();}
    else if(action==='date-today'||action==='date-tomorrow'){listForm.date=action==='date-today'?localDate():nextDay();listFormSheet();}
    else if(action==='add-duration'){captureDraft();draft.expanded=true;render();$('#add-duration').focus();}
    else if(action==='remove-duration'){captureDraft();draft.duration='';draft.unit='min';draft.expanded=false;render();$('#task-input').focus();}
    else if(action==='edit-task')editTask(button.dataset.id);
    else if(action==='delete-task'){if(await change({type:'deleteTask',listId:activeId,taskId:editingTask})){closeSheet();flash('Aufgabe gelöscht.',true);}}
    else if(action==='undo'){if(await change({type:'undo'}))flash('Wiederhergestellt.');}
    else if(action==='menu')menu();
    else if(action==='settings')await settingsSheet();
    else if(action==='quit')await api.window('quit');
    else if(action==='list-menu')showSheet('Diese Liste',`<div class="menu-actions">${menuAction('edit-list','Liste bearbeiten','edit')}${menuAction('confirm-delete-list','Liste löschen','close')}</div>`);
    else if(action==='edit-list'){const list=activeList();listForm={mode:list.date?'day':'title',date:list.date||localDate(),title:list.title,editing:list.id};listFormSheet();}
    else if(action==='confirm-delete-list')showSheet('Liste löschen?',`<p class="sheet-description">„${escapeHtml(label(activeList()))}“ und alle Aufgaben darin werden gelöscht.</p><div class="confirm-actions"><button class="primary" data-action="delete-list">Liste löschen</button><button class="text-button" data-action="close-sheet">Abbrechen</button></div>`);
    else if(action==='delete-list'){if(await change({type:'deleteList',listId:activeId})){closeSheet();flash('Liste gelöscht.',true);}}
    else if(action==='export'){if(await api.export())flash('JSON exportiert.');}
    else if(action==='import'){const imported=await api.import();if(imported){state=imported;activeId=null;render();closeSheet();flash('Listen importiert.');}}
    else if(action==='backup'){await api.backup();flash('Backup erstellt.');}
    else if(action==='backups')await backups();
    else if(action==='restore'){const restored=await api.restore(button.dataset.name);if(restored){state=restored;activeId=null;render();closeSheet();flash('Backup wiederhergestellt.');}}
    else if(action==='folder')await api.folder();
  }catch(e){error(e.message);}
}
document.addEventListener('click',handleClick);
document.addEventListener('change',async event=>{
  if(event.target.matches('[data-setting]')){
    const input=event.target,key=input.dataset.setting;
    if(busy){input.checked=settingsState[key];return;}
    busy=true;clearError();
    document.querySelectorAll('[data-setting]').forEach(e=>e.disabled=true);
    try{settingsState=await api.setting(key,input.checked);flash('Einstellung gespeichert.');}
    catch(e){error(e.message);}
    finally{
      document.querySelectorAll('[data-setting]').forEach(e=>{e.checked=settingsState[e.dataset.setting];e.disabled=e.dataset.setting==='openAtLogin'&&!settingsState.autoStartAvailable;});
      busy=false;
    }
  }
  if(event.target.matches('.task-check')){
    if(busy){event.target.checked=!event.target.checked;return;}
    const scroll=$('.task-scroll').scrollTop;
    const ok=await change({type:'toggleTask',listId:activeId,taskId:event.target.dataset.task});
    if(ok)$('.task-scroll').scrollTop=scroll;else event.target.checked=!event.target.checked;
  }
  if(event.target.id==='list-date'){listForm.date=event.target.value;document.querySelectorAll('.date-shortcuts button').forEach(b=>b.classList.toggle('selected',listForm.date===(b.dataset.action==='date-today'?localDate():nextDay())));}
});
document.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;const form=event.target;
  if(form.id==='task-form'){
    captureDraft();if(!draft.text.trim()){error('Gib zuerst eine Aufgabe ein.');$('#task-input').focus();return;}
    form.querySelectorAll('input,button,select').forEach(e=>e.disabled=true);
    const ok=await change({type:'addTask',listId:activeId,text:draft.text,duration:draft.duration,unit:draft.unit},{rerender:false});
    if(ok){draft={text:'',duration:'',unit:'min',expanded:false};render();$('#task-input').focus();const scroller=$('.task-scroll');scroller.scrollTop=scroller.scrollHeight;}
    else form.querySelectorAll('input,button,select').forEach(e=>e.disabled=false);
  }else if(form.id==='list-form'){
    captureListForm();
    const date=listForm.mode==='day'?listForm.date:null;
    if(listForm.mode==='day'&&!date){error('Wähle ein Datum.');return;}
    const existing=!listForm.editing&&date&&state.lists.find(l=>l.date===date);
    if(existing){activeId=existing.id;closeSheet();render();flash('Die Liste für diesen Tag ist schon da.');return;}
    const ok=await change({type:listForm.editing?'editList':'createList',listId:listForm.editing,date,title:listForm.title},{rerender:false});
    if(ok){activeId=listForm.editing||state.lists.at(-1).id;closeSheet();render();$('#task-input').focus();}
  }else if(form.id==='edit-task-form'){
    const ok=await change({type:'editTask',listId:activeId,taskId:editingTask,text:$('#edit-text').value,duration:$('#edit-duration').value,unit:$('#edit-unit').value});
    if(ok)closeSheet();
  }
});
$('#minimize').addEventListener('click',()=>api.window('minimize'));
$('#close').addEventListener('click',()=>api.window('close'));
$('#sheet').addEventListener('click',event=>{if(event.target===$('#sheet')){const rect=$('#sheet').getBoundingClientRect();if(event.clientY<rect.top||event.clientX<rect.left||event.clientX>rect.right)closeSheet();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#sheet').open&&activeId){captureDraft();activeId=null;render();}if((event.ctrlKey||event.metaKey)&&event.key==='n'){event.preventDefault();listForm={mode:'day',date:localDate(),title:'',editing:null};listFormSheet();}});
function checkDay(){const day=localDate();if(day!==lastDay){lastDay=day;captureDraft();render();}}
setInterval(checkDay,15000);window.addEventListener('focus',checkDay);
api.load().then(data=>{state=data.state;appVersion=data.version;render();if(data.recovery)showSheet('Wiederherstellung',`<p class="sheet-description">${escapeHtml(data.recovery)}</p><button class="primary" data-action="close-sheet">Verstanden</button>`);}).catch(e=>{$('#app').innerHTML=`<div class="fatal"><h1>Speicher nicht erreichbar.</h1><p>${escapeHtml(e.message)}</p><p>Bitte schließe die App und starte sie erneut.</p></div>`;});
