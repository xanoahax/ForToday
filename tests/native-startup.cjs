// Real Windows registration smoke test. Refuses to overwrite an existing ForToday login entry.
const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {spawnSync}=require('node:child_process');
const runKey='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
if(spawnSync('reg.exe',['query',runKey,'/v','ForToday'],{windowsHide:true}).status===0)throw new Error('Existing ForToday autostart registration found; refusing to change it for a test.');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fortoday-native-'));
const executable=path.resolve(process.env.FORTODAY_TEST_EXE||'release/win-unpacked/ForToday.exe');
let app,lastPage;
async function launch(args=[]){
  const env={...process.env,FORTODAY_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:executable,args,env,timeout:30000});
  const page=await app.firstWindow();lastPage=page;await page.waitForSelector('#new-list',{state:'attached'});return page;
}
const osSettings=()=>app.evaluate(({app})=>app.getLoginItemSettings({path:`"${process.execPath}"`,args:['--autostart']}));
(async()=>{try{
  let page=await launch();
  await page.getByRole('button',{name:'Menü',exact:true}).click();await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
  const startup=()=>page.getByRole('switch',{name:'Mit Windows starten',exact:true});
  await expect(startup()).toBeEnabled();await expect(startup()).not.toBeChecked();
  await startup().check();
  await expect.poll(async()=> (await osSettings()).launchItems.some(item=>item.name==='ForToday'&&item.enabled&&item.scope==='user')).toBe(true);
  await expect(page.locator('#sheet-error')).toBeHidden();
  const entry=(await osSettings()).launchItems.find(item=>item.name==='ForToday');
  expect(entry.path.toLowerCase()).toBe(executable.toLowerCase());
  const command=spawnSync('reg.exe',['query',runKey,'/v','ForToday'],{windowsHide:true,encoding:'utf8'});
  expect(command.stdout).toContain(`"${executable}" --autostart`);
  // Task Manager can disable the startup item outside the app.
  await app.evaluate(({app})=>app.setLoginItemSettings({name:'ForToday',path:process.execPath,args:['--autostart'],openAtLogin:true,enabled:false}));
  await page.getByRole('button',{name:'Zurück zum Menü',exact:true}).click();await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
  await expect(startup()).not.toBeChecked();
  await startup().check();
  await page.getByRole('switch',{name:'Beim Schließen ins Tray',exact:true}).check();
  await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(dir,'settings.json'))).closeToTray).toBe(true);
  await page.locator('#toast').waitFor({state:'hidden'});
  await page.screenshot({path:path.resolve('test-results/08-native-settings.png')});
  await app.close();page=await launch(['--autostart']);
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  await app.evaluate(({app})=>app.emit('second-instance',{},[],process.cwd()));
  await page.getByRole('button',{name:'Menü',exact:true}).click();await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
  await expect(startup()).toBeChecked();await startup().uncheck();
  await expect.poll(async()=> (await osSettings()).launchItems.some(item=>item.name==='ForToday')).toBe(false);
  await page.getByRole('button',{name:'Zurück zum Menü',exact:true}).click();
  const closed=app.waitForEvent('close');await page.getByRole('button',{name:'ForToday beenden',exact:true}).click();await closed;app=null;
  console.log('PASS: packaged Windows autostart enable/disable, exact path with spaces, Task Manager changes, hidden login start, explicit Quit.');
}catch(error){
  if(app){console.error('OS startup state:',JSON.stringify(await osSettings()));console.error('Settings error:',await lastPage.locator('#sheet-error').textContent());}
  throw error;
}finally{
  if(app){await app.evaluate(({app})=>app.setLoginItemSettings({name:'ForToday',path:process.execPath,args:['--autostart'],openAtLogin:false,enabled:false})).catch(()=>{});await app.close().catch(()=>{});}
  // This test has exclusive ownership: it checked absence before adding this value.
  spawnSync('reg.exe',['delete',runKey,'/v','ForToday','/f'],{windowsHide:true});
  spawnSync('reg.exe',['delete','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run','/v','ForToday','/f'],{windowsHide:true});
  fs.rmSync(dir,{recursive:true,force:true});
}})().catch(e=>{console.error(e);process.exitCode=1;});
