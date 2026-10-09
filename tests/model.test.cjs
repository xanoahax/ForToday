const {test} = require('node:test');
const assert = require('node:assert/strict');
const {emptyState, applyAction, validateState, parseDuration, localDate} = require('../src/model.cjs');
const day = () => applyAction(emptyState(), {type:'createList', date:'2026-10-09'});
test('day lists cannot duplicate; named lists trim their titles', () => {
  let s = day();
  assert.throws(() => applyAction(s,{type:'createList',date:'2026-10-09'}), /existiert/);
  s = applyAction(s,{type:'createList',title:'  Projekt  '});
  assert.equal(s.lists[1].title,'Projekt');
  assert.equal(s.lists[1].date,null);
  assert.throws(() => applyAction(s,{type:'createList',title:'  '}));
});
test('invalid calendar dates and impossible durations are rejected', () => {
  for (const date of ['2026-02-29','2026-13-01','hi']) assert.throws(() => applyAction(emptyState(),{type:'createList',date}));
  assert.equal(parseDuration('', 'min'),null);
  assert.equal(parseDuration('1,5','h'),90);
  assert.equal(parseDuration('45','min'),45);
  for (const value of ['-1','0','abc','1e3','0.001','999999']) assert.throws(() => parseDuration(value,'h'));
  assert.equal(localDate(new Date(2026,9,9,23,59)),'2026-10-09');
});
test('task add/edit/toggle/delete persists semantics without mutating input', () => {
  const original=day(); const listId=original.lists[0].id;
  let s=applyAction(original,{type:'addTask',listId,text:'  Film schneiden  ',minutes:90});
  assert.equal(original.lists[0].tasks.length,0);
  const taskId=s.lists[0].tasks[0].id;
  assert.equal(s.lists[0].tasks[0].text,'Film schneiden');
  s=applyAction(s,{type:'toggleTask',listId,taskId});
  assert.equal(s.lists[0].tasks[0].done,true);
  s=applyAction(s,{type:'editTask',listId,taskId,text:'Schnitt',minutes:null});
  assert.equal(s.lists[0].tasks[0].minutes,null);
  s=applyAction(s,{type:'deleteTask',listId,taskId});
  assert.equal(s.lists[0].tasks.length,0);
});
test('invalid imported data cannot silently become an empty database', () => {
  for(const bad of [{}, {version:2,lists:[]}, {version:1,lists:[{}]}]) assert.throws(() => validateState(bad));
  const s=day(); const id=s.lists[0].id;
  const withTask=applyAction(s,{type:'addTask',listId:id,text:'Sicher',minutes:null});
  withTask.lists[0].tasks[0].done='false';
  assert.throws(() => validateState(withTask));
  assert.throws(() => validateState({...s, lists:[s.lists[0],s.lists[0]]}));
});
test('list editing, deletion and literal markup text', () => {
  let s=day(); const listId=s.lists[0].id;
  s=applyAction(s,{type:'editList',listId,title:'<script>alert(1)</script>',date:null});
  assert.equal(s.lists[0].title,'<script>alert(1)</script>');
  s=applyAction(s,{type:'deleteList',listId});
  assert.equal(s.lists.length,0);
});
