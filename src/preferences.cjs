const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');

class Preferences {
  constructor(dir) {
    this.dir=dir;
    this.file=path.join(dir,'settings.json');
    this.state={version:1,closeToTray:false};
    this.recovery=null;
  }
  load() {
    if(!fs.existsSync(this.file))return this.state;
    try {
      if(fs.statSync(this.file).size>4096)throw new Error('Settings too large');
      const data=JSON.parse(fs.readFileSync(this.file,'utf8'));
      if(data.version!==1||typeof data.closeToTray!=='boolean')throw new Error('Invalid settings');
      this.state={version:1,closeToTray:data.closeToTray};
    }catch(error){
      if(error.code)throw error;
      fs.renameSync(this.file,path.join(this.dir,`settings-corrupt-${randomUUID()}.json`));
      this.recovery='Die Einstellungen waren beschädigt und wurden zurückgesetzt. Deine Listen sind unverändert.';
    }
    return this.state;
  }
  setCloseToTray(enabled) {
    if(typeof enabled!=='boolean')throw new Error('Ungültige Einstellung.');
    const next={version:1,closeToTray:enabled};
    fs.mkdirSync(this.dir,{recursive:true});
    const temp=this.file+'.tmp';
    const fd=fs.openSync(temp,'w');
    try{fs.writeFileSync(fd,JSON.stringify(next,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temp,this.file);
    this.state=next;
  }
}
module.exports={Preferences};
