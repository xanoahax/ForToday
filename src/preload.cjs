const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(name,...args)=>{const result=await ipcRenderer.invoke(name,...args);if(!result.ok)throw new Error(result.error);return result.value;};
contextBridge.exposeInMainWorld('forToday',{
  load:()=>invoke('load'),action:action=>invoke('action',action),backup:()=>invoke('backup'),backups:()=>invoke('backups'),restore:name=>invoke('restore',name),export:()=>invoke('export'),import:()=>invoke('import'),folder:()=>invoke('folder'),window:action=>invoke('window',action),settings:()=>invoke('settings'),setting:(key,value)=>invoke('setting',key,value)
});
