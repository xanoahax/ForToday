const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fortoday-tray-e2e-'));
fs.mkdirSync(path.resolve('test-results'),{recursive:true});
let app;
async function launch(extraArgs=[]){
  const env={...process.env,FORTODAY_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:[path.resolve('.'),...extraArgs],env,timeout:30000});
  const page=await app.firstWindow();await page.waitForSelector('#new-list',{state:'attached'});return page;
}
(async()=>{try{
  let page=await launch();
  await page.getByRole('button',{name:'Menü',exact:true}).click();
  await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
  const toggle=()=>page.getByRole('switch',{name:'Beim Schließen ins Tray',exact:true});
  await expect(toggle()).not.toBeChecked();
  await expect(page.getByRole('switch',{name:'Mit Windows starten',exact:true})).toBeDisabled();
  await toggle().check();
  await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(dir,'settings.json'))).closeToTray).toBe(true);
  await page.screenshot({path:path.resolve('test-results/07-settings.png')});
  await page.getByRole('button',{name:'Schließen',exact:true}).click();
  await page.getByRole('button',{name:'Fenster schließen',exact:true}).click();
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  // A second launch must reopen the existing window, not create another process/window.
  await app.evaluate(({app})=>app.emit('second-instance',{},[],process.cwd()));
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);
  await app.close();page=await launch(['--autostart']);
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  await app.evaluate(({app})=>app.emit('second-instance',{},[],process.cwd()));
  await page.getByRole('button',{name:'Menü',exact:true}).click();
  await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
  await expect(toggle()).toBeChecked();
  await toggle().uncheck();
  await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(dir,'settings.json'))).closeToTray).toBe(false);
  await page.getByRole('button',{name:'Schließen',exact:true}).click();
  const closed=app.waitForEvent('close');
  await page.getByRole('button',{name:'Fenster schließen',exact:true}).click();await closed;app=null;
  console.log('PASS: settings UI, real window hides/reopens, persisted tray setting, autostart hidden, normal close exits.');
}finally{if(app)await app.close().catch(()=>{});fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
