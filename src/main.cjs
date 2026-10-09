const {app,BrowserWindow,ipcMain,dialog,shell,Menu,nativeTheme,Tray}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {Store}=require('./store.cjs');
const {validateState,parseDuration}=require('./model.cjs');
const {Preferences}=require('./preferences.cjs');
const {DesktopIntegration}=require('./desktop.cjs');
if(process.env.FORTODAY_DATA_DIR) app.setPath('userData',process.env.FORTODAY_DATA_DIR);
app.setAppUserModelId('local.fortoday.app');
let win,store,desktop,preferences;
if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(desktop)desktop.show();});
  app.whenReady().then(()=>{
    nativeTheme.themeSource='light';Menu.setApplicationMenu(null);
    try {store=new Store(app.getPath('userData'));store.load();preferences=new Preferences(app.getPath('userData'));preferences.load();}
    catch(e) {dialog.showErrorBox('ForToday – Daten konnten nicht geladen werden',`${e.message}\n\nDatenordner: ${app.getPath('userData')}`);app.quit();return;}
    win=new BrowserWindow({width:420,height:780,minWidth:360,minHeight:540,frame:false,show:false,backgroundColor:'#ffffff',title:'ForToday',icon:path.join(__dirname,'../assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
    desktop=new DesktopIntegration({app,win,Tray,Menu,preferences,icon:path.join(__dirname,'../assets/icon.ico'),executable:process.env.PORTABLE_EXECUTABLE_FILE||process.execPath,supportsStartup:app.isPackaged&&process.platform==='win32',argv:process.argv});
    try{desktop.initialize();}catch(error){
      // Keep the window accessible if Windows cannot create a tray icon.
      preferences.state.closeToTray=false;
      preferences.recovery=`Das Tray-Symbol konnte nicht erstellt werden. Das Fenster bleibt sichtbar. ${error.message}`;
    }
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',event=>event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    win.once('ready-to-show',()=>{if(!desktop.shouldStartHidden())win.show();});
    win.loadFile(path.join(__dirname,'ui/index.html'));
    const handle=(name,fn)=>ipcMain.handle(name,async(event,...args)=>{
      if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame) return {ok:false,error:'Zugriff verweigert.'};
      try{return {ok:true,value:await fn(...args)};}catch(e){return {ok:false,error:e.message};}
    });
    handle('load',()=>({state:store.state,recovery:[store.recovery,preferences.recovery].filter(Boolean).join('\n'),version:app.getVersion()}));
    handle('settings',()=>desktop.getSettings());
    handle('setting',(key,value)=>desktop.updateSetting(key,value));
    handle('action',action=>{
      if(!action||typeof action!=='object') throw new Error('Ungültige Aktion.');
      if(['addTask','editTask'].includes(action.type)) action.minutes=parseDuration(action.duration??'',action.unit??'min');
      return store.dispatch(action);
    });
    handle('backup',()=>store.backup());
    handle('backups',()=>store.listBackups());
    handle('restore',async name=>{
      const answer=await dialog.showMessageBox(win,{type:'question',title:'Backup wiederherstellen',message:'Aktuelle Listen durch dieses Backup ersetzen?',detail:'Vorher wird automatisch eine Sicherheitskopie deiner aktuellen Listen gespeichert.',buttons:['Abbrechen','Wiederherstellen'],defaultId:0,cancelId:0,noLink:true});
      if(answer.response!==1) return null;
      return store.restore(name);
    });
    handle('export',async()=>{
      const result=await dialog.showSaveDialog(win,{title:'Listen als JSON exportieren',defaultPath:`ForToday-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'JSON',extensions:['json']}]});
      if(result.canceled) return false;
      fs.writeFileSync(result.filePath,JSON.stringify(store.state,null,2)+'\n','utf8');return true;
    });
    handle('import',async()=>{
      const result=await dialog.showOpenDialog(win,{title:'ForToday-Datei importieren',properties:['openFile'],filters:[{name:'ForToday JSON',extensions:['json']}]});
      if(result.canceled) return null;
      const incoming=validateState(store.read(result.filePaths[0]));
      const answer=await dialog.showMessageBox(win,{type:'question',title:'Listen importieren',message:`${incoming.lists.length} Listen importieren und die aktuellen Listen ersetzen?`,detail:'Deine aktuellen Listen werden vorher als Sicherheitskopie gespeichert.',buttons:['Abbrechen','Importieren'],defaultId:0,cancelId:0,noLink:true});
      return answer.response===1?store.importData(incoming):null;
    });
    handle('folder',async()=>{const error=await shell.openPath(store.dir);if(error) throw new Error(error);});
    handle('window',action=>{if(action==='close')win.close();else if(action==='minimize')win.minimize();else if(action==='quit')app.quit();});
  });
  app.on('window-all-closed',()=>app.quit());
}
