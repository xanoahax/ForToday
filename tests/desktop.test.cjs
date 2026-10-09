const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {Preferences}=require('../src/preferences.cjs');
const {DesktopIntegration}=require('../src/desktop.cjs');

function fixture(t,{packaged=true,argv=[],saved=false}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fortoday-desktop-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const preferences=new Preferences(dir);preferences.load();if(saved)preferences.setCloseToTray(true);
  const app=new EventEmitter();let registration=null;let visible=true;let minimized=false;let exited=false;
  app.getVersion=()=> '1.1.0';
  // Electron openAtLogin checks the AppUserModelID entry, not a custom registration name.
  app.getLoginItemSettings=options=>{
    // Electron 44.7 parses this path as a command line; spaces require quotes.
    const queriedPath=options.path.startsWith('"')?options.path.slice(1,-1):options.path.split(' ')[0];
    return {openAtLogin:false,executableWillLaunchAtLogin:!!registration?.enabled,launchItems:registration&&registration.path===queriedPath?[{name:'ForToday',scope:'user',args:[],enabled:registration.enabled}]:[]};
  };
  app.setLoginItemSettings=options=>{registration=options.openAtLogin?options:null;};
  const win=new EventEmitter();win.isDestroyed=()=>false;win.isMinimized=()=>minimized;win.restore=()=>{minimized=false;};win.show=()=>{visible=true;};win.focus=()=>{};win.hide=()=>{visible=false;};
  win.close=()=>{let prevented=false;win.emit('close',{preventDefault(){prevented=true;}});if(!prevented)exited=true;};
  app.quit=()=>{app.emit('before-quit');win.close();};
  class Tray extends EventEmitter {
    constructor(){super();this.destroyed=false;Tray.instances.push(this);}
    setToolTip(value){this.tooltip=value;}
    setContextMenu(menu){this.menu=menu;}
    destroy(){this.destroyed=true;}
    isDestroyed(){return this.destroyed;}
    static instances=[];
  }
  const desktop=new DesktopIntegration({app,win,Tray,Menu:{buildFromTemplate:items=>items},preferences,icon:'icon.ico',executable:'C:\\Program Files\\ForToday\\ForToday.exe',supportsStartup:packaged,argv});
  desktop.initialize();
  return {desktop,app,win,Tray,preferences,dir,isVisible:()=>visible,hasExited:()=>exited,registration:()=>registration,setRegistration:value=>{registration=value;}};
}

test('close normally quits, enabled close hides and tray reopens the same window',t=>{
  const f=fixture(t);
  assert.equal(f.desktop.getSettings().closeToTray,false);
  f.desktop.updateSetting('closeToTray',true);
  f.win.close();assert.equal(f.isVisible(),false);assert.equal(f.hasExited(),false);
  f.Tray.instances[0].emit('click');assert.equal(f.isVisible(),true);
  f.win.close();f.Tray.instances[0].menu.find(i=>i.label==='Öffnen').click();assert.equal(f.isVisible(),true);
  f.desktop.updateSetting('closeToTray',false);
  assert.equal(f.Tray.instances[0].destroyed,true);f.win.close();assert.equal(f.hasExited(),true);
});
test('tray quit, app quit and Windows shutdown bypass close-to-tray',t=>{
  const f=fixture(t,{saved:true});f.Tray.instances[0].menu.find(i=>i.label==='Beenden').click();assert.equal(f.hasExited(),true);
  const g=fixture(t,{saved:true});g.app.quit();assert.equal(g.hasExited(),true);
  const h=fixture(t,{saved:true});h.win.emit('query-session-end');h.win.close();assert.equal(h.hasExited(),true);
});
test('preferences survive restart and startup is hidden only with autostart plus tray',t=>{
  const f=fixture(t,{saved:true,argv:['--autostart']});
  assert.equal(new Preferences(f.dir).load().closeToTray,true);
  assert.equal(f.desktop.shouldStartHidden(),true);
  assert.equal(fixture(t,{saved:true}).desktop.shouldStartHidden(),false);
  assert.equal(fixture(t,{argv:['--autostart']}).desktop.shouldStartHidden(),false);
});
test('startup uses stable executable and argument; Windows is source of truth',t=>{
  const f=fixture(t);
  f.desktop.updateSetting('openAtLogin',true);
  assert.equal(f.registration().path,'C:\\Program Files\\ForToday\\ForToday.exe');
  assert.deepEqual(f.registration().args,['--autostart']);assert.equal(f.registration().name,'ForToday');
  assert.equal(f.desktop.getSettings().openAtLogin,true);
  f.setRegistration({...f.registration(),enabled:false});assert.equal(f.desktop.getSettings().openAtLogin,false);
  f.desktop.updateSetting('openAtLogin',false);assert.equal(f.registration(),null);
});
test('invalid settings, development autostart and denied OS changes fail visibly',t=>{
  const f=fixture(t,{packaged:false});
  assert.throws(()=>f.desktop.updateSetting('openAtLogin',true),/installierten/);
  assert.throws(()=>f.desktop.updateSetting('closeToTray','yes'));
  assert.throws(()=>f.desktop.updateSetting('unknown',true));
  const g=fixture(t);g.app.setLoginItemSettings=()=>{};
  assert.throws(()=>g.desktop.updateSetting('openAtLogin',true),/Windows/);
});
test('failed preference write does not enable tray behavior or persist success',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.dir,'settings.json.tmp'));
  assert.throws(()=>f.desktop.updateSetting('closeToTray',true));
  assert.equal(f.desktop.getSettings().closeToTray,false);
  f.win.close();assert.equal(f.hasExited(),true);
});
test('corrupt settings are preserved and safely default to normal close',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.dir,'settings.json'),'broken');
  const next=new Preferences(f.dir);assert.equal(next.load().closeToTray,false);
  assert.ok(next.recovery);assert.ok(fs.readdirSync(f.dir).some(n=>n.startsWith('settings-corrupt-')));
});
