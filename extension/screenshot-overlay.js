(function(root){'use strict';
 const VERSION='2.5.13';
 if(root.SOPImageOverlay?.version===VERSION)return;
 root.SOPImageOverlay?.dispose?.();root.document.getElementById('sop-image-overlay-host')?.remove();
 let active=null;
 function dispose(token){if(active&&(!token||active.token===token)){active.host.remove();active=null;}}
 function mount(url,token){
  const parsed=new URL(url),base=new URL(chrome.runtime.getURL('screenshot-viewer.html'));
  if(parsed.origin!==base.origin||parsed.pathname!==base.pathname||!/^[-a-zA-Z0-9]{8,100}$/.test(token))throw Error('Invalid screenshot frame.');
  dispose();const host=root.document.createElement('div');host.id='sop-image-overlay-host';
  host.style.cssText='position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;width:100vw!important;height:100vh!important;';
  const shadow=host.attachShadow({mode:'closed'}),frame=root.document.createElement('iframe');
  frame.src=parsed.href;frame.title='Running SOP';frame.style.cssText='display:block;border:0;width:100%;height:100%;background:#101216;';
  shadow.append(frame);root.document.documentElement.append(host);active={token,host};return true;
 }
 root.SOPImageOverlay=Object.freeze({version:VERSION,mount,dispose,alive:token=>Boolean(active?.token===token&&active.host.isConnected)});
})(globalThis);
