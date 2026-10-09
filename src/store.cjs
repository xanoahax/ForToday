const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {emptyState,validateState,applyAction}=require('./model.cjs');
function serialize(state) {
  const text=JSON.stringify(state,null,2)+'\n';
  if(Buffer.byteLength(text,'utf8')>25*1024*1024) throw new Error('Die Daten sind zu groß (maximal 25 MB). Bitte Listen aufteilen oder alte Listen exportieren.');
  return text;
}
class Store {
  constructor(dir) {this.dir=dir;this.file=path.join(dir,'tasks.json');this.backups=path.join(dir,'backups');this.state=null;this.recovery=null;this.undoState=null;fs.mkdirSync(this.backups,{recursive:true});}
  read(file) {if(fs.statSync(file).size>25*1024*1024) throw new Error('Die Datei ist zu groß (maximal 25 MB).');return validateState(JSON.parse(fs.readFileSync(file,'utf8')));}
  load() {
    if(!fs.existsSync(this.file)) {this.state=emptyState();this.write(this.state);return this.state;}
    try {this.state=this.read(this.file);} catch(error) {
      if(error.code&&error.code!=='ENOENT') throw error;
      for(const backup of this.listBackups()) {
        let candidate;try {candidate=this.read(path.join(this.backups,backup.name));} catch {continue;}
        fs.copyFileSync(this.file,path.join(this.dir,`tasks-corrupt-${Date.now()}.json`),fs.constants.COPYFILE_EXCL);
        this.write(candidate);this.state=candidate;this.recovery='Die Datendatei war beschädigt. Das letzte gültige Backup wurde wiederhergestellt. Die beschädigte Datei bleibt im Datenordner erhalten.';break;
      }
      if(!this.state) throw new Error('Die Datendatei ist beschädigt; kein gültiges Backup gefunden. Die Originaldatei wurde nicht verändert.');
    }
    return this.state;
  }
  write(state,serialized=serialize(state)) {
    const temp=this.file+'.tmp';
    const fd=fs.openSync(temp,'w');
    try {fs.writeFileSync(fd,serialized,'utf8');fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
    fs.renameSync(temp,this.file);
  }
  backup(prefix='manual') {
    const name=`${prefix}-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}.json`;
    fs.writeFileSync(path.join(this.backups,name),serialize(this.state),{encoding:'utf8',flag:'wx'});
    // Keep manual/import safety copies indefinitely, bound automatic history only.
    if(prefix==='auto') for(const old of this.listBackups().filter(b=>b.name.startsWith('auto-')).slice(30)) fs.unlinkSync(path.join(this.backups,old.name));
    return {name};
  }
  commit(next,prefix='auto') {const validated=validateState(next),serialized=serialize(validated);this.backup(prefix);this.write(validated,serialized);this.state=validated;return structuredClone(this.state);}
  dispatch(action) {
    if(action.type==='undo') {if(!this.undoState) throw new Error('Nichts zum Rückgängigmachen.');const result=this.commit(this.undoState);this.undoState=null;return result;}
    const previous=this.state;
    const result=this.commit(applyAction(this.state,action));
    this.undoState=['deleteTask','deleteList'].includes(action.type)?previous:null;
    return result;
  }
  listBackups() {return fs.readdirSync(this.backups).filter(name=>/^(auto|manual|before-import|before-restore)-[\w-]+\.json$/.test(name)).map(name=>({name,modified:fs.statSync(path.join(this.backups,name)).mtimeMs})).sort((a,b)=>b.modified-a.modified||b.name.localeCompare(a.name));}
  restore(name) {if(!this.listBackups().some(b=>b.name===name)) throw new Error('Backup nicht gefunden.');const result=this.commit(this.read(path.join(this.backups,name)),'before-restore');this.undoState=null;return result;}
  importData(data) {const result=this.commit(validateState(data),'before-import');this.undoState=null;return result;}
}
module.exports={Store};
