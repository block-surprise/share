const $=s=>document.querySelector(s);
const state={history:JSON.parse(localStorage.getItem("daboxair.history")||"[]"),quick:JSON.parse(localStorage.getItem("daboxair.quick")||"[]"),files:[],devices:[],settings:JSON.parse(localStorage.getItem("daboxair.settings")||'{"theme":"system","saveHistory":true,"clearAfterSend":true,"notifications":false}')};
let ws=null,myId=null;

function save(){localStorage.setItem("daboxair.history",JSON.stringify(state.history));localStorage.setItem("daboxair.quick",JSON.stringify(state.quick));localStorage.setItem("daboxair.settings",JSON.stringify(state.settings))}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function renderQuick(){const e=$("#quickList");e.innerHTML=state.quick.length?state.quick.map((x,i)=>`<div class="quick-item"><div class="quick-text">${esc(x)}</div><div><button onclick="useQuick(${i})">使う</button></div></div>`).join(""):`<div class="hint">よく使う文章を登録できます。</div>`}
function renderHistory(){const q=$("#historySearch").value.toLowerCase();const a=state.history.filter(x=>(x.text||"").toLowerCase().includes(q));$("#historyList").innerHTML=a.length?a.map(x=>`<div class="history-item"><div class="history-text">${esc(x.text||"ファイル送信")}</div><small>${new Date(x.time).toLocaleString("ja-JP")}</small></div>`).join(""):`<div class="hint">履歴はありません。</div>`}
function renderDevices(){const html=state.devices.length?state.devices.map(d=>`<div class="device-item"><div class="device-icon">${d.platform==="Windows"?"▣":"⌁"}</div><div><b>${esc(d.name)}</b><small>${esc(d.platform)}</small></div></div>`).join(""):`<div class="hint">まだデバイスがありません。</div>`;$("#deviceList").innerHTML=html;$("#sendDevices").innerHTML=html}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderSettings(){const s=state.settings;$("#themeSelect").value=s.theme;$("#saveHistory").checked=s.saveHistory;$("#clearAfterSend").checked=s.clearAfterSend;$("#notifications").checked=s.notifications;applyTheme()}
function applyTheme(){const t=state.settings.theme;document.body.classList.toggle("dark",t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))}
function connect(){
  const proto=location.protocol==="https:"?"wss":"ws"; ws=new WebSocket(`${proto}://${location.host}`);
  ws.onopen=()=>{ $("#statusText").textContent="接続済み";$("#connectionDot").classList.add("on");send({type:"identify",name:"iPhone",platform:"iPhone"}); };
  ws.onclose=()=>{ $("#statusText").textContent="未接続";$("#connectionDot").classList.remove("on");setTimeout(connect,2500)};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}handle(m)};
}
function send(x){if(ws?.readyState===1)ws.send(JSON.stringify(x))}
function handle(m){
 if(m.type==="welcome")myId=m.id;
 if(m.type==="devices"){state.devices=m.devices.filter(d=>d.id!==myId);renderDevices()}
 if(m.type==="paired"){state.devices=[...state.devices.filter(d=>d.id!==m.device.id),m.device];renderDevices();toast("ペアリングしました")}
 if(m.type==="error")toast(m.message);
 if(m.type==="received"){const p=m.packet||{};if(state.settings.saveHistory){state.history.unshift({text:p.text||"ファイル受信",time:Date.now()});state.history=state.history.slice(0,100);save();renderHistory()}toast(`${m.from?.name||"デバイス"}から受信`);if(state.settings.notifications&&Notification?.permission==="granted")new Notification("daboxair",{body:p.text||"ファイルを受信しました"})}
}
async function sendContent(){
 const text=$("#textInput").value.trim();if(!text&&!state.files.length){toast("送信する内容を入力してください");return}
 const packets=[];if(text)packets.push({kind:"text",text});
 for(const f of state.files){if(f.size>8*1024*1024){toast("8MBを超えるファイルは送信できません");return}packets.push({kind:"file",name:f.name,type:f.type,size:f.size,data:await fileData(f)})}
 for(const packet of packets)send({type:"share",packet});
 if(state.settings.saveHistory){state.history.unshift({text:text||state.files.map(f=>f.name).join(", "),time:Date.now()});state.history=state.history.slice(0,100);save();renderHistory()}
 if(state.settings.clearAfterSend){$("#textInput").value="";state.files=[];renderFiles();updateCount()}
 toast("送信しました");
}
function fileData(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}
function renderFiles(){$("#attachments").innerHTML=state.files.map((f,i)=>`<span class="attachment">${esc(f.name)} <button onclick="removeFile(${i})">×</button></span>`).join("")}
function removeFile(i){state.files.splice(i,1);renderFiles()}
function updateCount(){$("#charCount").textContent=`${$("#textInput").value.length} / 5000`}
function pair(code){code=String(code).replace(/\D/g,"");if(code.length!==6){toast("6桁のコードを入力してください");return}send({type:"pair",code})}
window.useQuick=i=>{$("#textInput").value=state.quick[i];updateCount();showPage("home");$("#textInput").focus()}
window.removeFile=removeFile;

function showPage(p){document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.dataset.page===p));document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.target===p));window.scrollTo(0,0)}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>showPage(b.dataset.target));
$("#textInput").oninput=updateCount;$("#sendBtn").onclick=sendContent;$("#clearBtn").onclick=()=>{$("#textInput").value="";state.files=[];renderFiles();updateCount()};
$("#attachBtn").onclick=()=>$("#fileInput").click();$("#fileInput").onchange=e=>{state.files.push(...e.target.files);renderFiles();e.target.value=""};
$("#historySearch").oninput=renderHistory;$("#clearHistoryBtn").onclick=()=>{state.history=[];save();renderHistory()};
$("#addQuickBtn").onclick=()=>{const t=prompt("登録する文章を入力");if(t?.trim()){state.quick.push(t.trim());save();renderQuick()}};
$("#pairBtn").onclick=()=>pair($("#pairInput").value);$("#modalPair").onclick=()=>{pair($("#modalCode").value);$("#modal").classList.add("hidden")};
$("#shareCodeBtn").onclick=()=>$("#modal").classList.remove("hidden");$("#closeModal").onclick=()=>$("#modal").classList.add("hidden");
$("#focusTextBtn").onclick=()=>{showPage("home");setTimeout(()=>$("#textInput").focus(),50)};
$("#themeSelect").onchange=e=>{state.settings.theme=e.target.value;save();applyTheme()};
["saveHistory","clearAfterSend","notifications"].forEach(id=>$("#"+id).onchange=async e=>{state.settings[id]=e.target.checked;if(id==="notifications"&&e.target.checked&&"Notification"in window)try{await Notification.requestPermission()}catch{}save()});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",applyTheme);
renderQuick();renderHistory();renderDevices();renderSettings();updateCount();connect();