const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const state={history:JSON.parse(localStorage.getItem("sf_history")||"[]"),image:null};

function save(){localStorage.setItem("sf_history",JSON.stringify(state.history.slice(0,100)))}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function renderHistory(){
  const q=($("#search")?.value||"").toLowerCase();
  const items=state.history.filter(x=>x.text.toLowerCase().includes(q));
  const html=items.length?items.map(x=>`<div class="history-item"><div class="history-text">${esc(x.text)}</div><div class="history-time">${new Date(x.time).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}</div><button class="copy" data-copy="${encodeURIComponent(x.text)}">コピー</button></div>`).join(""):`<div class="note">まだ履歴がありません。</div>`;
  $("#history").innerHTML=html; $("#recent").innerHTML=html.slice(0,2000);
}
function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function copy(t){await navigator.clipboard.writeText(t);toast("コピーしました")}
function go(page){
  $$(".page").forEach(p=>p.classList.toggle("active",p.dataset.page===page));
  $$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===page));
  $("#pageTitle").textContent={home:"ホーム",history:"履歴",send:"送信",devices:"デバイス",settings:"設定"}[page];
  if(page==="history")renderHistory(); if(page==="home")renderHistory();
}
$$(".tab").forEach(b=>b.onclick=()=>go(b.dataset.tab));
$$("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
$("#message").oninput=()=>$("#charCount").textContent=`${$("#message").value.length} / 5000`;
$("#imageBtn").onclick=$("#imageBtn2").onclick=()=>$("#imageInput").click();
$("#imageInput").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{state.image=r.result;$("#preview").innerHTML=`<img src="${r.result}" alt="preview">`};r.readAsDataURL(f)};
$("#sendBtn").onclick=()=>{
  const text=$("#message").value.trim();
  if(!text && !state.image){toast("送信する内容を入力してください");return}
  const packet={type:"share",text:text||"画像",image:state.image};
  if(ws?.readyState===1)ws.send(JSON.stringify(packet));else toast("サーバーに接続できません");
  if(text && $("#saveHistory").checked){state.history.unshift({text,time:Date.now()});save();renderHistory()}
  if($("#clearAfter").checked){$("#message").value="";$("#charCount").textContent="0 / 5000";state.image=null;$("#preview").innerHTML="";$("#imageInput").value=""}
  toast("送信しました");
};
$("#search").oninput=renderHistory;
$("#clearHistory").onclick=()=>{state.history=[];save();renderHistory();toast("履歴を削除しました")};
$("#copyUrl").onclick=()=>copy(location.href);
$("#theme").onchange=e=>applyTheme(e.target.value);
function applyTheme(v){document.documentElement.dataset.theme=v==="system"?"":v;localStorage.setItem("sf_theme",v)}
$("#theme").value=localStorage.getItem("sf_theme")||"system";applyTheme($("#theme").value);

let ws;
function connect(){
  const proto=location.protocol==="https:"?"wss":"ws";
  ws=new WebSocket(`${proto}://${location.host}`);
  ws.onopen=()=>{$("#connectionText").textContent="接続中";$("#dot").style.background="#34c759"};
  ws.onclose=()=>{$("#connectionText").textContent="未接続";$("#dot").style.background="#ff3b30";setTimeout(connect,2000)};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==="share"){toast("新しい共有を受信しました"); if(m.text)state.history.unshift({text:m.text,time:Date.now()});save();renderHistory()}};
}
connect();renderHistory();
