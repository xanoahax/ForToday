// Native desktop behavior. The injected dependencies keep OS changes out of unit tests.
class DesktopIntegration {
  constructor({app,win,Tray,Menu,preferences,icon,executable,supportsStartup,argv}) {
    Object.assign(this,{app,win,Tray,Menu,preferences,icon,executable,supportsStartup,argv});
    this.tray=null;
    this.quitting=false;
    this.startupName='ForToday';
    this.startupArgs=['--autostart'];
  }
  initialize() {
    this.app.on('before-quit',()=>{this.quitting=true;});
    this.app.on('will-quit',()=>this.destroyTray());
    this.win.on('query-session-end',()=>{this.quitting=true;});
    this.win.on('session-end',()=>{this.quitting=true;});
    this.win.on('close',event=>{
      if(!this.quitting&&this.preferences.state.closeToTray&&this.tray&&!this.tray.isDestroyed()){
        event.preventDefault();this.win.hide();
      }
    });
    if(this.preferences.state.closeToTray)this.ensureTray();
  }
  show() {
    if(this.win.isDestroyed())return;
    if(this.win.isMinimized())this.win.restore();
    this.win.show();this.win.focus();
  }
  ensureTray() {
    if(this.tray&&!this.tray.isDestroyed())return;
    const tray=new this.Tray(this.icon);
    try{
      tray.setToolTip('ForToday');
      tray.setContextMenu(this.Menu.buildFromTemplate([
        {label:'Öffnen',click:()=>this.show()},
        {type:'separator'},
        {label:'Beenden',click:()=>this.app.quit()}
      ]));
      tray.on('click',()=>this.show());
      tray.on('double-click',()=>this.show());
      this.tray=tray;
    }catch(error){tray.destroy();throw error;}
  }
  destroyTray() {if(this.tray&&!this.tray.isDestroyed())this.tray.destroy();this.tray=null;}
  shouldStartHidden() {return this.argv.includes('--autostart')&&this.preferences.state.closeToTray&&!!this.tray;}
  startupEnabled() {
    if(!this.supportsStartup)return false;
    // Electron 44.7 parses the query path as a command line. Quote paths with spaces.
    // openAtLogin checks AppUserModelID, so our named entry must be read from launchItems.
    const settings=this.app.getLoginItemSettings({path:`"${this.executable}"`,args:this.startupArgs});
    // launchItems.args omits command-line switches in this Electron version.
    return settings.launchItems.some(item=>item.name===this.startupName&&item.scope==='user'&&item.enabled);
  }
  getSettings() {
    return {closeToTray:this.preferences.state.closeToTray,openAtLogin:this.startupEnabled(),autoStartAvailable:this.supportsStartup,version:this.app.getVersion()};
  }
  updateSetting(key,value) {
    if(typeof value!=='boolean'||!['closeToTray','openAtLogin'].includes(key))throw new Error('Ungültige Einstellung.');
    if(key==='openAtLogin'){
      if(!this.supportsStartup)throw new Error('Autostart ist in der installierten oder portablen Windows-Version verfügbar.');
      this.app.setLoginItemSettings({openAtLogin:value,enabled:value,path:this.executable,args:this.startupArgs,name:this.startupName});
      if(this.startupEnabled()!==value)throw new Error('Windows konnte die Autostart-Einstellung nicht übernehmen. Bitte die Windows-Autostart-Einstellungen prüfen.');
    }else{
      const hadTray=!!this.tray;
      if(value)this.ensureTray();
      try{this.preferences.setCloseToTray(value);}catch(error){if(!hadTray)this.destroyTray();throw error;}
      if(!value){this.show();this.destroyTray();}
    }
    return this.getSettings();
  }
}
module.exports={DesktopIntegration};
