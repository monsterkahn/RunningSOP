(function (root, factory) {
  'use strict';
  const api = factory(root);
  root.RunningSOPTeamSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const KEY = 'runtime-sop-team-settings-v1';
  const copy = v => JSON.parse(JSON.stringify(v));
  function fail(code) { const e = Error('Team settings: ' + code); e.code = code; return e; }
  // Extension-origin IndexedDB is unavailable to work-page content scripts. Only
  // public connection metadata enters chrome.storage.local for change events.
  function privateStorage() {
    async function operation(mode, action) {
      const db = await new Promise((resolve,reject) => { const req = root.indexedDB.open('running-sop-team-private',1); req.onupgradeneeded = () => req.result.createObjectStore('settings'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(fail('storage_error')); });
      try { return await new Promise((resolve,reject) => { const tx = db.transaction('settings',mode), store = tx.objectStore('settings'); let result; const req = action(store); req.onsuccess = () => { result = req.result; }; tx.oncomplete = () => resolve(result); tx.onerror = tx.onabort = () => reject(fail('storage_error')); }); }
      finally { db.close(); }
    }
    return {get:() => operation('readonly',s => s.get(KEY)),set:v => operation('readwrite',s => s.put(v,KEY)),remove:() => operation('readwrite',s => s.delete(KEY))};
  }
  function create(options = {}) {
    const storage = options.storage || privateStorage(), permissions = options.permissions || root.chrome?.permissions;
    const client = options.client || root.RunningSOPTeamClient;
    const notify = options.notify || (async record => { await root.chrome.storage.local.set({[KEY]:record}); });
    let busy = false;
    async function read() {
      const value = await storage.get();
      if (!value || value.enabled !== true || !value.token || !value.endpoint || value.protocolVersion !== 1) return {enabled:false};
      return copy(value);
    }
    async function commit(next) {
      const previous = await storage.get();
      try { if (next.enabled) await storage.set(next); else await storage.remove(); await notify(next.enabled ? {enabled:true,endpoint:next.endpoint,actorId:next.actor.id,protocolVersion:1} : {enabled:false}); }
      catch (_) { if (previous) await storage.set(previous); else await storage.remove(); throw fail('storage_error'); }
    }
    async function connect(input) {
      if (busy) throw fail('busy');
      const endpoint = client.validateEndpoint(input.endpoint);
      if (typeof input.joinCode !== 'string' || !input.joinCode.trim() || input.joinCode.length > 128 || typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.length > 80) throw fail('invalid_session');
      // This call must remain before the first await to retain the user gesture.
      const granted = permissions.request({origins:[new URL(endpoint).origin + '/*']});
      busy = true;
      try {
        if (!await granted) throw fail('permission_denied');
        const anonymous = client.create({endpoint});
        await anonymous.capabilities();
        const session = await anonymous.join(input.joinCode,input.displayName.trim());
        const authenticated = client.create({endpoint,token:session.token});
        await authenticated.list({limit:1});
        const next = {enabled:true,endpoint,token:session.token,actor:copy(session.actor),expiresAt:session.expiresAt,protocolVersion:1};
        await commit(next);
        return copy(next);
      } finally { busy = false; }
    }
    async function clear() { if (busy) throw fail('busy'); busy = true; try { await commit({enabled:false}); } finally { busy = false; } }
    return Object.freeze({KEY,read,clear,connect});
  }
  // Ordered strings keep this self-contained without changing the shared locale catalog.
  const strings = {
    en:['Team service','Service URL','Your display name','Join code','Connect','Disconnect','Not connected · folder storage is the default.','Connected','Connecting…','Connection failed. Check the address, code, permissions and service.','HTTP does not encrypt join codes or sessions on your network. Use HTTPS.','Connection settings stay on this browser; the join code is never saved.'],
    zh:['多人协作','服务地址','您的显示名称','加入码','连接','断开连接','未连接 · 默认使用文件夹存储。','已连接','正在连接…','连接失败，请检查地址、加入码、权限和服务。','HTTP 不会加密网络上的加入码和会话，建议使用 HTTPS。','连接设置仅保存在本机浏览器，不会保存加入码。'],
    'zh-TW':['多人協作','服務位址','您的顯示名稱','加入碼','連線','中斷連線','未連線 · 預設使用資料夾儲存。','已連線','正在連線…','連線失敗，請檢查位址、加入碼、權限和服務。','HTTP 不會加密網路上的加入碼和工作階段，建議使用 HTTPS。','連線設定僅儲存在本機瀏覽器，不會儲存加入碼。'],
    es:['Servicio de equipo','URL del servicio','Nombre visible','Código de acceso','Conectar','Desconectar','Sin conexión · se usa una carpeta por defecto.','Conectado','Conectando…','Error de conexión. Revisa la dirección, el código, los permisos y el servicio.','HTTP no cifra los códigos ni las sesiones en la red. Usa HTTPS.','La configuración queda en este navegador; el código no se guarda.'],
    ru:['Командный сервис','Адрес сервиса','Ваше имя','Код подключения','Подключить','Отключить','Не подключено · по умолчанию используется папка.','Подключено','Подключение…','Ошибка подключения. Проверьте адрес, код, разрешения и сервис.','HTTP не шифрует коды и сеансы в сети. Используйте HTTPS.','Настройки хранятся в этом браузере; код не сохраняется.'],
    ko:['팀 서비스','서비스 주소','표시 이름','참여 코드','연결','연결 해제','연결 안 됨 · 기본값은 폴더 저장소입니다.','연결됨','연결 중…','연결에 실패했습니다. 주소, 코드, 권한과 서비스를 확인하세요.','HTTP는 네트워크의 참여 코드와 세션을 암호화하지 않습니다. HTTPS를 사용하세요.','설정은 이 브라우저에만 저장되며 참여 코드는 저장되지 않습니다.'],
    ja:['チームサービス','サービス URL','表示名','参加コード','接続','切断','未接続 · 標準ではフォルダーに保存します。','接続済み','接続中…','接続に失敗しました。アドレス、コード、権限、サービスを確認してください。','HTTP はネットワーク上の参加コードやセッションを暗号化しません。HTTPS を使用してください。','設定はこのブラウザーにのみ保存され、参加コードは保存されません。']
  };
  const libraryLabels={en:'Open team library',zh:'打开团队内容库','zh-TW':'開啟團隊內容庫',es:'Abrir biblioteca de equipo',ru:'Открыть командную библиотеку',ko:'팀 라이브러리 열기',ja:'チームライブラリを開く'};
  for(const [code,values] of Object.entries(strings))values.push(libraryLabels[code]);
  const joinHelp={
    en:['Where do I get a join code?','Ask the administrator running the team service. A generated code is shown once in the first-start terminal or container logs and saved in config.json in the service data directory. A configured JOIN_CODE overrides that saved value. Shared-folder storage does not need a join code.'],
    zh:['加入码在哪看？','请向运行团队服务的管理员索取。自动生成的加入码会在首次启动的终端或容器日志中显示一次，并保存在服务数据目录的 config.json 中。若配置了 JOIN_CODE，则以该配置为准。仅使用共享文件夹时不需要加入码。'],
    'zh-TW':['加入碼在哪裡查看？','請向執行團隊服務的管理員索取。自動產生的加入碼會在首次啟動的終端或容器日誌顯示一次，並儲存在服務資料目錄的 config.json 中。若設定了 JOIN_CODE，則以該設定為準。僅使用共用資料夾時不需要加入碼。'],
    es:['¿Dónde consigo el código?','Pídelo al administrador del servicio. El código generado aparece una vez en los registros del primer inicio y se guarda en config.json del directorio de datos. JOIN_CODE tiene prioridad si está configurado. Una carpeta compartida no necesita código.'],
    ru:['Где взять код подключения?','Обратитесь к администратору сервиса. Сгенерированный код выводится один раз при первом запуске в терминале или журнале контейнера и сохраняется в config.json каталога данных. Настройка JOIN_CODE имеет приоритет. Для общей папки код не нужен.'],
    ko:['참여 코드는 어디서 확인하나요?','팀 서비스 관리자에게 요청하세요. 생성된 코드는 첫 실행 터미널 또는 컨테이너 로그에 한 번 표시되고 데이터 폴더의 config.json에 저장됩니다. JOIN_CODE 설정이 있으면 그 값을 사용합니다. 공유 폴더에는 코드가 필요 없습니다.'],
    ja:['参加コードはどこで確認できますか？','チームサービスの管理者に確認してください。生成されたコードは初回起動時の端末やコンテナログに一度表示され、データフォルダーの config.json に保存されます。JOIN_CODE の設定が優先されます。共有フォルダーだけならコードは不要です。']
  };
  const nameWords={
    en:['Use device name','A short name saved in this browser. You can edit the display name.','Device name unavailable. Enter a display name.'],
    zh:['使用设备名称','本机浏览器保存的简短名称，显示名称仍可手动修改。','无法读取设备名称，请手动填写显示名称。'],
    'zh-TW':['使用裝置名稱','本機瀏覽器儲存的簡短名稱，顯示名稱仍可手動修改。','無法讀取裝置名稱，請手動填寫顯示名稱。'],
    es:['Usar nombre del equipo','Nombre corto guardado en este navegador. Puedes editarlo.','Nombre no disponible. Escribe un nombre.'],
    ru:['Имя устройства','Короткое имя сохранено в браузере. Его можно изменить.','Имя недоступно. Введите имя.'],
    ko:['기기 이름 사용','이 브라우저에 저장된 짧은 이름입니다. 표시 이름을 수정할 수 있습니다.','기기 이름을 읽지 못했습니다. 이름을 입력하세요.'],
    ja:['デバイス名を使用','このブラウザーに保存する短い名前です。表示名は編集できます。','デバイス名を取得できません。表示名を入力してください。']
  };
  let singleton;
  function instance() { return singleton || (singleton = create()); }
  async function initialize() {
    const doc = root.document, form = doc?.getElementById('team-connect-form'); if (!form) return;
    const get = id => doc.getElementById(id); let record = {enabled:false}, state = 'idle', readGeneration = 0, naming = false, deviceName = '';
    const nameReady=Promise.resolve().then(()=>root.RunningSOPDeviceName.get()).then(name=>{deviceName=name;if(!get('team-display-name').value&&!record.enabled)get('team-display-name').value=name;render();}).catch(()=>{});
    function render() {
      const words = strings[root.WorkspaceI18n?.getLanguage()] || strings.en;const names=nameWords[root.WorkspaceI18n?.getLanguage()]||nameWords.en;if(get('team-use-device-name')){get('team-use-device-name').textContent=names[0];get('team-use-device-name').disabled=state==='busy'||naming;}if(get('team-name-help'))get('team-name-help').textContent=names[1];
      doc.querySelectorAll('[data-team-text]').forEach(node => { node.textContent = words[Number(node.dataset.teamText)]; });
      const help=joinHelp[root.WorkspaceI18n?.getLanguage()]||joinHelp.en;if(get('team-join-help-title'))get('team-join-help-title').textContent=help[0];if(get('team-join-help'))get('team-join-help').textContent=help[1];
      get('team-status').textContent = words[state === 'busy' ? 8 : state === 'error' ? 9 : record.enabled ? 7 : 6] + (record.enabled && state === 'idle' ? (deviceName?' · '+deviceName:'')+' · ' + record.endpoint : '');
      if(get('team-library'))get('team-library').hidden=!record.enabled;if(get('team-choose-service'))get('team-choose-service').disabled=state==='busy';root.RunningSOPTeamPicker?.refreshCurrent(record);
      get('team-connect').disabled = state === 'busy'; get('team-disconnect').disabled = state === 'busy' || !record.enabled;
      let url; try { url = new URL(get('team-endpoint').value); } catch (_) {}
      get('team-http-warning').hidden = !url || url.protocol !== 'http:' || ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    }
    async function refreshRecord(populate = false) {
      const generation = ++readGeneration;
      try {
        const value = await instance().read();
        if (generation !== readGeneration) return;
        record = value;
        if (populate && record.enabled) {
          get('team-endpoint').value = record.endpoint;
          get('team-display-name').value = record.actor?.name || '';
        }
        render();
      } catch (_) {
        if (generation !== readGeneration) return;
        state = 'error'; render();
      }
    }
    if(get('team-use-device-name'))get('team-use-device-name').onclick=async()=>{
      if(state==='busy'||naming)return;const field=get('team-display-name'),previous=field.value;naming=true;render();
      try{const name=await root.RunningSOPDeviceName.get();deviceName=name;if(state!=='busy'&&field.value===previous){field.value=name;field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();}}
      catch(_){if(get('team-name-help'))get('team-name-help').textContent=(nameWords[root.WorkspaceI18n?.getLanguage()]||nameWords.en)[2];}
      finally{naming=false;get('team-use-device-name').disabled=state==='busy';}
    };
    form.addEventListener('submit', async event => {
      event.preventDefault();if(state==='busy')return;if(!get('team-endpoint').value&&root.RunningSOPTeamPicker){root.RunningSOPTeamPicker.open();return;}if(!form.reportValidity())return;
      const pending = instance().connect({endpoint:get('team-endpoint').value,joinCode:get('team-join-code').value,displayName:get('team-display-name').value});
      const generation = ++readGeneration;
      state = 'busy'; render();
      try { const next = await pending; if (generation === readGeneration) record = next; state = 'idle';await root.RunningSOPTeamPicker?.rememberCurrent(next); } catch (_) { state = 'error'; }
      finally { get('team-join-code').value = ''; render(); await refreshRecord(); }
    });
    get('team-disconnect').addEventListener('click',async () => { if (state === 'busy') return; const generation = ++readGeneration; state = 'busy'; render(); try { await instance().clear(); if (generation === readGeneration) record = {enabled:false}; state = 'idle'; } catch (_) { state = 'error'; } render(); await refreshRecord(); });
    get('team-endpoint').addEventListener('input',render);
    root.chrome?.storage?.onChanged?.addListener((changes,area) => { if (area === 'local' && changes[KEY]) refreshRecord(); });
    // Language and private connection settings load independently. Repaint
    // after the language is applied, whichever read finishes first.
    doc.addEventListener('workspace-language-change',render);
    await refreshRecord(true);
    await nameReady;
  }
  if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded',initialize,{once:true}); else initialize(); }
  return Object.freeze({KEY,create,read:() => instance().read(),clear:() => instance().clear(),connect:input => instance().connect(input)});
});
