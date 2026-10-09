const {randomUUID}=require('node:crypto');
const emptyState=()=>({version:1,lists:[]});
const fail=(message)=>{throw new Error(message);};
function localDate(date=new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d=new Date(`${value}T12:00:00`);
  return Number.isFinite(d.getTime())&&localDate(d)===value&&value>='1900-01-01'&&value<='9999-12-31';
}
function cleanText(value,max=500) {
  if(typeof value!=='string'||!value.trim()||value.trim().length>max) fail(`Bitte 1 bis ${max} Zeichen eingeben.`);
  return value.trim();
}
function validMinutes(value) {if(value!==null&&(!Number.isInteger(value)||value<1||value>525600)) fail('Bitte eine Dauer zwischen 1 Minute und 8760 Stunden eingeben.');return value;}
function parseDuration(value,unit='min') {
  const text=String(value).trim().replace(',','.');
  if(!text) return null;
  if(!/^\d+(\.\d+)?$/.test(text)||!['min','h'].includes(unit)) fail('Bitte eine gültige Dauer eingeben.');
  const minutes=Number(text)*(unit==='h'?60:1);
  if(Math.abs(minutes-Math.round(minutes))>0.000001) fail('Die kleinste Zeiteinheit ist eine Minute.');
  return validMinutes(Math.round(minutes));
}
function validateState(data) {
  if(!data||data.version!==1||!Array.isArray(data.lists)||data.lists.length>10000) fail('Keine gültige ForToday-Datei (Version 1).');
  const ids=new Set(),dates=new Set();
  const id=value=>{if(typeof value!=='string'||!value||value.length>100||ids.has(value)) fail('Ungültige oder doppelte ID.');ids.add(value);return value;};
  const stamp=value=>{if(typeof value!=='string'||!Number.isFinite(Date.parse(value))) fail('Ungültiger Zeitstempel.');return value;};
  return {version:1,lists:data.lists.map(list=>{
    if(!list||!Array.isArray(list.tasks)||list.tasks.length>50000) fail('Ungültige Liste.');
    const date=list.date;
    if(date!==null) {if(!validDate(date)) fail('Ungültiges Datum.');if(dates.has(date)) fail('Für diesen Tag existiert bereits eine Liste.');dates.add(date);}
    return {id:id(list.id),title:date===null?cleanText(list.title,120):'',date,createdAt:stamp(list.createdAt),tasks:list.tasks.map(task=>{
      if(!task||typeof task.done!=='boolean') fail('Ungültige Aufgabe.');
      return {id:id(task.id),text:cleanText(task.text),done:task.done,minutes:validMinutes(task.minutes),createdAt:stamp(task.createdAt)};
    })};
  })};
}
function applyAction(state,action) {
  const next=structuredClone(state);
  const now=new Date().toISOString();
  const list=next.lists.find(l=>l.id===action.listId);
  if(action.type==='createList') next.lists.push({id:randomUUID(),title:action.date?'':cleanText(action.title,120),date:action.date||null,createdAt:now,tasks:[]});
  else {
    if(!list) fail('Diese Liste wurde nicht gefunden.');
    if(action.type==='editList') {list.date=action.date||null;list.title=list.date?'':cleanText(action.title,120);}
    else if(action.type==='deleteList') next.lists=next.lists.filter(l=>l.id!==list.id);
    else if(action.type==='addTask') list.tasks.push({id:randomUUID(),text:cleanText(action.text),minutes:validMinutes(action.minutes??null),done:false,createdAt:now});
    else {
      const task=list.tasks.find(t=>t.id===action.taskId);
      if(!task) fail('Diese Aufgabe wurde nicht gefunden.');
      if(action.type==='toggleTask') task.done=!task.done;
      else if(action.type==='editTask') {task.text=cleanText(action.text);task.minutes=validMinutes(action.minutes??null);}
      else if(action.type==='deleteTask') list.tasks=list.tasks.filter(t=>t.id!==task.id);
      else fail('Unbekannte Aktion.');
    }
  }
  return validateState(next);
}
module.exports={emptyState,validateState,applyAction,parseDuration,localDate};
