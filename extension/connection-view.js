(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ConnectionView=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function state({settings={},status={},sourceInfo,checking=false}={}){
 if(checking)return 'checking';
 if(!settings.endpoint)return 'unconfigured';
 const directory=typeof settings.endpoint==='string'&&settings.endpoint.startsWith('sop-directory:');
 if(directory&&(!sourceInfo?.selected||sourceInfo.endpoint!==settings.endpoint))return 'offline';
 if(directory&&sourceInfo.readPermission!=='granted')return 'permission';
 if(status.state==='blocked')return 'permission';
 if(status.state==='offline'||status.state==='error')return 'offline';
 if(status.state==='ready')return status.endpoint&&status.endpoint!==settings.endpoint?'idle':'ready';
 return 'idle';
}
const labels={unconfigured:['未连接','等待选择文件夹'],checking:['连接中','正在检查读取权限'],ready:['已连接','可读取 SOP'],offline:['未连接','暂时无法读取'],permission:['待授权','需要读取许可'],idle:['待检查','点击检查连接']};
return Object.freeze({state,labels});
});
