// Smoke test the exact portable EXE users receive, using a disposable profile.
const {chromium,expect}=require('@playwright/test');
const {spawn}=require('node:child_process');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const net=require('node:net');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fortoday-portable-'));
const executable=path.resolve(`release/ForToday-${require('../package.json').version}-Portable.exe`);
let child,browser;
async function launch(){
  const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
  const env={...process.env,FORTODAY_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
  child=spawn(executable,[`--remote-debugging-port=${port}`],{env,windowsHide:true,stdio:'ignore'});
  let endpoint;
  for(let i=0;i<200;i++){
    try{endpoint=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();break;}catch{await new Promise(resolve=>setTimeout(resolve,200));}
  }
  if(!endpoint)throw new Error('Portable EXE did not open its window.');
  browser=await chromium.connectOverCDP(endpoint.webSocketDebuggerUrl);
  const context=browser.contexts()[0];let page=context.pages()[0];if(!page)page=await context.waitForEvent('page');
  await page.waitForSelector('#new-list');return page;
}
async function close(page){
  const exited=new Promise(resolve=>child.once('exit',resolve));
  await page.getByRole('button',{name:'Fenster schließen',exact:true}).click();
  await Promise.race([exited,new Promise((_,reject)=>setTimeout(()=>reject(new Error('EXE did not exit')),10000))]);
}
(async()=>{try{
  let page=await launch();
  await page.getByRole('button',{name:'Neue Liste',exact:true}).click();
  await page.getByRole('button',{name:'Liste anlegen',exact:true}).click();
  await page.getByPlaceholder('Neue Aufgabe …').fill('Portable EXE geprüft');await page.getByPlaceholder('Neue Aufgabe …').press('Enter');
  await expect(page.locator('.task-row')).toHaveCount(1);
  const stored=JSON.parse(fs.readFileSync(path.join(dir,'tasks.json')));expect(stored.lists[0].tasks[0].text).toBe('Portable EXE geprüft');
  await close(page);page=await launch();
  await expect(page.locator('.list-card.today')).toContainText('Portable EXE geprüft');
  await page.screenshot({path:path.resolve('test-results/06-portable.png')});
  await close(page);
  console.log('PASS: portable EXE starts, creates tasks, persists JSON, closes and reopens with saved data.');
}finally{if(browser)await browser.close().catch(()=>{});if(child&&child.exitCode===null)child.kill();fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
