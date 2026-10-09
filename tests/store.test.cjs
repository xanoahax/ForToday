const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Store}=require('../src/store.cjs');
function setup(t) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fortoday-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,store:new Store(dir)};}
test('real JSON survives restart and backup restore',t=>{
  const {dir,store}=setup(t);store.load();
  const s=store.dispatch({type:'createList',title:'Arbeit'});
  store.dispatch({type:'addTask',listId:s.lists[0].id,text:'Angebot',minutes:30});
  const backup=store.backup();
  store.dispatch({type:'deleteList',listId:s.lists[0].id});
  store.restore(backup.name);
  const restarted=new Store(dir);const loaded=restarted.load();
  assert.equal(loaded.lists[0].tasks[0].text,'Angebot');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'tasks.json'))).lists[0].tasks[0].minutes,30);
});
test('bad import and path traversal preserve state; valid import has safety backup',t=>{
  const {dir,store}=setup(t);store.load();store.dispatch({type:'createList',title:'Nicht verlieren'});
  const before=fs.readFileSync(path.join(dir,'tasks.json'),'utf8');
  assert.throws(()=>store.importData({version:1,lists:[{}]}));
  assert.throws(()=>store.restore('../tasks.json'));
  assert.equal(fs.readFileSync(path.join(dir,'tasks.json'),'utf8'),before);
  store.importData({version:1,lists:[]});
  const safety=store.listBackups().find(b=>b.name.startsWith('before-import'));
  assert.ok(safety);store.restore(safety.name);
  assert.equal(store.state.lists[0].title,'Nicht verlieren');
});
test('corruption recovers latest valid backup and preserves broken file',t=>{
  const {dir,store}=setup(t);store.load();store.dispatch({type:'createList',title:'Gerettet'});store.backup();
  fs.writeFileSync(path.join(dir,'tasks.json'),'{broken');
  const next=new Store(dir);assert.equal(next.load().lists[0].title,'Gerettet');
  assert.ok(next.recovery);assert.ok(fs.readdirSync(dir).some(f=>f.startsWith('tasks-corrupt-')));
});
test('failed writes do not advance memory',t=>{
  const {dir,store}=setup(t);store.load();
  fs.mkdirSync(path.join(dir,'tasks.json.tmp'));
  assert.throws(()=>store.dispatch({type:'createList',title:'Unsaved'}));
  assert.equal(store.state.lists.length,0);
});
test('unrecoverable data fails closed',t=>{
  const {dir}=setup(t);
  fs.writeFileSync(path.join(dir,'tasks.json'),'broken');
  assert.throws(()=>new Store(dir).load(),/beschädigt/);
  assert.equal(fs.readFileSync(path.join(dir,'tasks.json'),'utf8'),'broken');
});
test('oversized serialized imports are rejected before changing state or backups',t=>{
  const {dir,store}=setup(t);store.load();store.dispatch({type:'createList',title:'Behalten'});
  const before=fs.readFileSync(path.join(dir,'tasks.json'),'utf8');
  const backups=store.listBackups().length;
  const data={version:1,lists:[{id:'large-list',title:'Import',date:null,createdAt:'2026-10-09T12:00:00.000Z',tasks:Array.from({length:40000},(_,i)=>({id:'task-'+i,text:'a'.repeat(500),done:false,minutes:null,createdAt:'2026-10-09T12:00:00.000Z'}))}]};
  assert.ok(Buffer.byteLength(JSON.stringify(data))<25*1024*1024);
  assert.throws(()=>store.importData(data),/25 MB/);
  assert.equal(store.listBackups().length,backups);
  assert.equal(fs.readFileSync(path.join(dir,'tasks.json'),'utf8'),before);
  assert.equal(new Store(dir).load().lists[0].title,'Behalten');
});
test('automatic backup rotation preserves manual copies and deletion undo',t=>{
  const {store}=setup(t);store.load();const s=store.dispatch({type:'createList',title:'Behalten'});const listId=s.lists[0].id;
  const manual=store.backup().name;
  for(let i=0;i<35;i++)store.dispatch({type:'addTask',listId,text:'Aufgabe '+i,minutes:null});
  assert.equal(store.listBackups().filter(b=>b.name.startsWith('auto-')).length,30);
  assert.ok(store.listBackups().some(b=>b.name===manual));
  store.dispatch({type:'deleteList',listId});store.dispatch({type:'undo'});
  assert.equal(store.state.lists[0].tasks.length,35);
});
