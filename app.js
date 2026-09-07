
(() => {
  const DAY_NAMES = {1:"Thứ 2",2:"Thứ 3",3:"Thứ 4",4:"Thứ 5",5:"Thứ 6",6:"Thứ 7",7:"Chủ nhật"};
  const STATUS = {
    pending:["Chưa dạy","pending"],
    taught:["Đã dạy","taught"],
    student_absent:["Học sinh nghỉ","student_absent"],
    teacher_absent:["Giáo viên nghỉ","teacher_absent"],
    makeup:["Dạy bù","makeup"],
    cancelled:["Hủy buổi","cancelled"]
  };
  const SEED = [
    ["Nam","VL12",2,"09:00","10:30"],["Nam","VL12",6,"09:00","10:30"],["Nam","VL12",7,"09:00","10:30"],
    ["Đức","VL12",2,"19:30","21:00"],["Đức","VL12",4,"19:30","21:00"],["Đức","VL12",6,"19:30","21:00"],
    ["Phát","VL10",5,"09:30","11:00"],["Phát","VL10",7,"14:00","15:30"],
    ["Đạt","VL10",1,"18:00","19:30"],["Đạt","VL10",5,"18:00","19:30"],
    ["Triết","VL11",3,"16:00","17:30"],["Triết","VL11",5,"15:00","16:30"]
  ];

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random().toString(16).slice(2));
  const pad = n => String(n).padStart(2,"0");
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
  const weekday = s => { const n=parseDate(s).getDay(); return n===0?7:n; };
  const viDate = s => parseDate(s).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  const esc = s => String(s??"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = msg => { const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove("show"),1800); };

  class LocalStore {
    constructor(){ this.sKey="qa_schedules_v1"; this.xKey="qa_sessions_v1"; }
    async init(){}
    schedules(){ return JSON.parse(localStorage.getItem(this.sKey)||"[]"); }
    sessions(){ return JSON.parse(localStorage.getItem(this.xKey)||"[]"); }
    saveSchedules(v){ localStorage.setItem(this.sKey,JSON.stringify(v)); }
    saveSessions(v){ localStorage.setItem(this.xKey,JSON.stringify(v)); }
    async getSchedules(){ return this.schedules().filter(x=>x.active!==false); }
    async upsertSchedule(x){
      const a=this.schedules(), i=a.findIndex(v=>v.id===x.id);
      if(i>=0)a[i]={...a[i],...x}; else a.push({...x,id:x.id||uid(),active:true});
      this.saveSchedules(a);
    }
    async deleteSchedule(id){ const a=this.schedules(); const i=a.findIndex(v=>v.id===id); if(i>=0){a[i].active=false;this.saveSchedules(a);} }
    async getSessions(){ return this.sessions(); }
    async upsertSession(x){
      const a=this.sessions(); const i=a.findIndex(v => v.key===x.key);
      const record={...x,id:x.id||uid(),updated_at:new Date().toISOString()};
      if(i>=0)a[i]={...a[i],...record}; else a.push(record);
      this.saveSessions(a);
    }
    async importData(data){
      if(data.schedules)localStorage.setItem(this.sKey,JSON.stringify(data.schedules));
      if(data.sessions)localStorage.setItem(this.xKey,JSON.stringify(data.sessions));
    }
    async exportData(){ return {schedules:this.schedules(),sessions:this.sessions()}; }
  }

  class SupabaseStore {
    constructor(client){ this.client=client; }
    async init(){}
    async getSchedules(){
      const {data,error}=await this.client.from("schedules").select("*").eq("active",true).order("weekday").order("start_time");
      if(error) throw error; return data||[];
    }
    async upsertSchedule(x){
      const payload={id:x.id||undefined,student_name:x.student_name,subject:x.subject,weekday:Number(x.weekday),start_time:x.start_time,end_time:x.end_time,active:x.active!==false};
      if(!payload.id) delete payload.id;
      const {error}=await this.client.from("schedules").upsert(payload); if(error)throw error;
    }
    async deleteSchedule(id){ const {error}=await this.client.from("schedules").update({active:false}).eq("id",id); if(error)throw error; }
    async getSessions(){
      const {data,error}=await this.client.from("sessions").select("*").order("session_date",{ascending:false});
      if(error)throw error; return (data||[]).map(x=>({...x,key:`${x.schedule_id||"custom"}|${x.original_date}`})); 
    }
    async upsertSession(x){
      const payload={
        schedule_id:x.schedule_id||null,original_date:x.original_date,session_date:x.session_date,
        start_time:x.start_time,end_time:x.end_time,student_name:x.student_name,subject:x.subject,
        status:x.status,note:x.note||""
      };
      const {error}=await this.client.from("sessions").upsert(payload,{onConflict:"user_id,schedule_id,original_date"}); if(error)throw error;
    }
    async exportData(){ return {schedules:await this.getSchedules(),sessions:await this.getSessions()}; }
    async importData(data){
      for(const s of (data.schedules||[])) await this.upsertSchedule({...s,id:undefined});
      for(const x of (data.sessions||[])) await this.upsertSession({...x,id:undefined});
    }
  }

  let store = new LocalStore();
  let supabaseClient = null;
  let cloudMode = false;
  let schedules = [];
  let sessions = [];
  let selectedDate = fmtDate(new Date());

  const configured = () => window.APP_CONFIG?.SUPABASE_URL && window.APP_CONFIG?.SUPABASE_ANON_KEY;

  async function initBackend(){
    if(!configured()) { $("#cloudBadge").textContent="Dữ liệu cục bộ"; return; }
    supabaseClient = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL,window.APP_CONFIG.SUPABASE_ANON_KEY);
    const {data:{session}} = await supabaseClient.auth.getSession();
    if(session){
      store=new SupabaseStore(supabaseClient); cloudMode=true; $("#cloudBadge").textContent="Supabase • Đã đăng nhập";
    } else {
      $("#cloudBadge").textContent="Supabase • Chưa đăng nhập";
    }
  }

  async function load(){
    schedules=await store.getSchedules();
    sessions=await store.getSessions();
    if(!schedules.length && !cloudMode) await seedIfEmpty(true);
    schedules=await store.getSchedules(); sessions=await store.getSessions();
    renderAll();
  }

  async function seedIfEmpty(silent=false){
    const current=await store.getSchedules();
    if(current.length){ if(!silent)toast("Lịch hiện tại không trống"); return; }
    for(const [student_name,subject,wd,start_time,end_time] of SEED){
      await store.upsertSchedule({id:uid(),student_name,subject,weekday:wd,start_time,end_time,active:true});
    }
    if(!silent)toast("Đã thêm lịch mẫu");
  }

  function occurrencesForDate(date){
    const wd=weekday(date);
    const movedFrom = new Set(sessions.filter(x=>x.original_date===date && x.session_date!==date).map(x=>x.schedule_id));
    const regular = schedules.filter(s=>Number(s.weekday)===wd && !movedFrom.has(s.id)).map(s=>{
      const key=`${s.id}|${date}`;
      const rec=sessions.find(x=>x.key===key || (x.schedule_id===s.id && x.original_date===date));
      return rec || {key,schedule_id:s.id,original_date:date,session_date:date,start_time:s.start_time,end_time:s.end_time,student_name:s.student_name,subject:s.subject,status:"pending",note:""};
    });
    const movedIn=sessions.filter(x=>x.session_date===date && x.original_date!==date);
    return [...regular,...movedIn].sort((a,b)=>a.start_time.localeCompare(b.start_time));
  }

  function statusLabel(st){ return STATUS[st]?.[0] || st; }

  function renderToday(){
    $("#todayDate").value=selectedDate;
    $("#todayLabel").textContent=viDate(selectedDate);
    const list=occurrencesForDate(selectedDate);
    const counts={total:list.length,taught:0,absent:0,pending:0};
    list.forEach(x=>{ if(x.status==="taught"||x.status==="makeup")counts.taught++; else if(x.status==="pending")counts.pending++; else counts.absent++; });
    $("#todaySummary").innerHTML=[
      ["Tổng ca",counts.total],["Đã dạy",counts.taught],["Nghỉ / hủy",counts.absent],["Chưa xử lý",counts.pending]
    ].map(([l,n])=>`<div class="summary-card"><div class="num">${n}</div><div class="label">${l}</div></div>`).join("");

    $("#todaySessions").innerHTML=list.length?list.map(x=>`
      <article class="session-card">
        <div class="session-top">
          <div>
            <div class="session-title">${esc(x.student_name)} · ${esc(x.subject)}</div>
            <div class="session-time">${esc(x.start_time.slice(0,5))}–${esc(x.end_time.slice(0,5))}</div>
            ${x.original_date!==x.session_date?`<div class="muted">Đã chuyển từ ${esc(x.original_date.split("-").reverse().join("/"))}</div>`:""}
            ${x.note?`<div class="muted" style="margin-top:6px">${esc(x.note)}</div>`:""}
          </div>
          <span class="status-pill ${esc(x.status)}">${statusLabel(x.status)}</span>
        </div>
        <div class="session-actions">
          ${["taught","student_absent","teacher_absent","makeup"].map(st=>`<button class="status-btn ${x.status===st?"active":""}" data-status="${st}" data-key="${esc(x.key)}">${statusLabel(st)}</button>`).join("")}
          <button class="ghost" data-reschedule="${esc(x.key)}">Đổi lịch buổi này</button>
          <button class="ghost" data-note="${esc(x.key)}">Ghi chú</button>
          <button class="ghost" data-status="cancelled" data-key="${esc(x.key)}">Hủy buổi</button>
        </div>
      </article>`).join(""):`<div class="empty">Không có ca dạy nào trong ngày này.</div>`;
  }

  function renderSchedule(){
    const grouped={}; for(let i=1;i<=7;i++)grouped[i]=[];
    schedules.forEach(s=>grouped[Number(s.weekday)].push(s));
    Object.values(grouped).forEach(a=>a.sort((x,y)=>x.start_time.localeCompare(y.start_time)));
    $("#weeklyGrid").innerHTML=Object.entries(grouped).map(([d,items])=>`
      <div class="day-column">
        <div class="day-title">${DAY_NAMES[d]}</div>
        ${items.map(s=>`
          <div class="schedule-card">
            <div class="name">${esc(s.student_name)}</div>
            <div class="sub">${esc(s.subject)}</div>
            <div class="time">${esc(s.start_time.slice(0,5))}–${esc(s.end_time.slice(0,5))}</div>
            <div class="card-actions">
              <button class="ghost" data-edit-schedule="${s.id}">Sửa</button>
              <button class="ghost" data-delete-schedule="${s.id}">Xóa</button>
            </div>
          </div>`).join("") || `<div class="muted">Trống</div>`}
      </div>`).join("");
  }

  function renderHistory(){
    const month=$("#historyMonth").value;
    const status=$("#historyStatus").value;
    let rows=sessions.filter(x=>x.status && x.status!=="pending");
    if(month)rows=rows.filter(x=>x.session_date.startsWith(month));
    if(status)rows=rows.filter(x=>x.status===status);
    rows.sort((a,b)=>b.session_date.localeCompare(a.session_date)||b.start_time.localeCompare(a.start_time));
    const taught=rows.filter(x=>["taught","makeup"].includes(x.status)).length;
    const absent=rows.filter(x=>["student_absent","teacher_absent","cancelled"].includes(x.status)).length;
    $("#historyStats").innerHTML=[
      ["Ghi nhận",rows.length],["Đã dạy",taught],["Nghỉ / hủy",absent],["Dạy bù",rows.filter(x=>x.status==="makeup").length]
    ].map(([l,n])=>`<div class="summary-card"><div class="num">${n}</div><div class="label">${l}</div></div>`).join("");
    $("#historyBody").innerHTML=rows.length?rows.map(x=>`
      <tr>
        <td>${esc(x.session_date.split("-").reverse().join("/"))}</td>
        <td><strong>${esc(x.student_name)}</strong><br><span class="muted">${esc(x.subject)}</span></td>
        <td>${esc(x.start_time.slice(0,5))}–${esc(x.end_time.slice(0,5))}</td>
        <td><span class="status-pill ${esc(x.status)}">${statusLabel(x.status)}</span></td>
        <td>${esc(x.note||"")}</td>
      </tr>`).join(""):`<tr><td colspan="5" class="muted">Chưa có dữ liệu.</td></tr>`;
  }

  async function renderSettings(){
    const area=$("#authArea");
    if(!configured()){
      area.innerHTML=`<div class="muted">Chưa cấu hình Supabase. Web đang lưu dữ liệu bằng localStorage.</div>`;
      return;
    }
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(session){
      area.innerHTML=`<div class="auth-box"><strong>${esc(session.user.email)}</strong><button id="logoutBtn" class="ghost">Đăng xuất</button></div>`;
      $("#logoutBtn").onclick=async()=>{await supabaseClient.auth.signOut();location.reload();};
    }else{
      area.innerHTML=`
        <div class="auth-box">
          <input id="authEmail" type="email" placeholder="Email" />
          <input id="authPassword" type="password" placeholder="Mật khẩu (tối thiểu 6 ký tự)" />
          <div class="auth-actions">
            <button id="loginBtn" class="primary">Đăng nhập</button>
            <button id="signupBtn" class="ghost">Tạo tài khoản</button>
          </div>
        </div>`;
      $("#loginBtn").onclick=()=>auth("login");
      $("#signupBtn").onclick=()=>auth("signup");
    }
  }

  async function auth(mode){
    const email=$("#authEmail").value.trim(), password=$("#authPassword").value;
    if(!email||!password)return toast("Nhập email và mật khẩu");
    const result=mode==="login"
      ? await supabaseClient.auth.signInWithPassword({email,password})
      : await supabaseClient.auth.signUp({email,password});
    if(result.error)return toast(result.error.message);
    toast(mode==="login"?"Đăng nhập thành công":"Đã tạo tài khoản");
    setTimeout(()=>location.reload(),600);
  }

  function renderAll(){ renderToday(); renderSchedule(); renderHistory(); renderSettings(); }

  function getOccurrenceByKey(key){
    let rec=sessions.find(x=>x.key===key);
    if(rec)return rec;
    const [sid,date]=key.split("|");
    const s=schedules.find(x=>x.id===sid);
    if(!s)return null;
    return {key,schedule_id:s.id,original_date:date,session_date:date,start_time:s.start_time,end_time:s.end_time,student_name:s.student_name,subject:s.subject,status:"pending",note:""};
  }

  async function saveOccurrence(x){
    await store.upsertSession(x);
    sessions=await store.getSessions();
    renderAll();
  }

  $$(".tab").forEach(btn=>btn.addEventListener("click",()=>{
    $$(".tab").forEach(x=>x.classList.remove("active")); btn.classList.add("active");
    $$(".view").forEach(x=>x.classList.remove("active")); $(`#view-${btn.dataset.view}`).classList.add("active");
  }));

  $("#todayDate").addEventListener("change",e=>{selectedDate=e.target.value;renderToday();});
  $("#prevDay").onclick=()=>{const d=parseDate(selectedDate);d.setDate(d.getDate()-1);selectedDate=fmtDate(d);renderToday();};
  $("#nextDay").onclick=()=>{const d=parseDate(selectedDate);d.setDate(d.getDate()+1);selectedDate=fmtDate(d);renderToday();};

  $("#todaySessions").addEventListener("click",async e=>{
    const st=e.target.dataset.status, key=e.target.dataset.key;
    if(st&&key){const x=getOccurrenceByKey(key); if(!x)return; x.status=st; await saveOccurrence(x); toast(statusLabel(st)); return;}
    if(e.target.dataset.reschedule){
      const x=getOccurrenceByKey(e.target.dataset.reschedule); if(!x)return;
      $("#rescheduleKey").value=x.key; $("#rescheduleDate").value=x.session_date;
      $("#rescheduleStart").value=x.start_time.slice(0,5); $("#rescheduleEnd").value=x.end_time.slice(0,5); $("#rescheduleNote").value=x.note||"";
      $("#rescheduleDialog").showModal(); return;
    }
    if(e.target.dataset.note){
      const x=getOccurrenceByKey(e.target.dataset.note); if(!x)return;
      $("#noteKey").value=x.key; $("#sessionNote").value=x.note||""; $("#noteDialog").showModal();
    }
  });

  $("#rescheduleForm").addEventListener("submit",async e=>{
    e.preventDefault(); const x=getOccurrenceByKey($("#rescheduleKey").value); if(!x)return;
    x.session_date=$("#rescheduleDate").value; x.start_time=$("#rescheduleStart").value; x.end_time=$("#rescheduleEnd").value;
    x.note=$("#rescheduleNote").value.trim(); if(x.status==="pending")x.status="pending";
    await saveOccurrence(x); $("#rescheduleDialog").close(); toast("Đã đổi lịch buổi này");
  });

  $("#noteForm").addEventListener("submit",async e=>{
    e.preventDefault(); const x=getOccurrenceByKey($("#noteKey").value); if(!x)return;
    x.note=$("#sessionNote").value.trim(); await saveOccurrence(x); $("#noteDialog").close(); toast("Đã lưu ghi chú");
  });

  $("#addScheduleBtn").onclick=()=>{
    $("#scheduleDialogTitle").textContent="Thêm ca dạy"; $("#scheduleForm").reset(); $("#scheduleId").value="";
    $("#scheduleDialog").showModal();
  };

  $("#weeklyGrid").addEventListener("click",async e=>{
    const edit=e.target.dataset.editSchedule, del=e.target.dataset.deleteSchedule;
    if(edit){
      const s=schedules.find(x=>x.id===edit); if(!s)return;
      $("#scheduleDialogTitle").textContent="Sửa lịch cố định"; $("#scheduleId").value=s.id; $("#studentName").value=s.student_name;
      $("#subjectName").value=s.subject; $("#weekday").value=s.weekday; $("#startTime").value=s.start_time.slice(0,5); $("#endTime").value=s.end_time.slice(0,5);
      $("#scheduleDialog").showModal();
    }
    if(del && confirm("Xóa ca này khỏi lịch cố định? Lịch sử chấm công cũ vẫn được giữ.")){
      await store.deleteSchedule(del); schedules=await store.getSchedules(); renderAll(); toast("Đã xóa ca");
    }
  });

  $("#scheduleForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const item={
      id:$("#scheduleId").value||uid(),student_name:$("#studentName").value.trim(),subject:$("#subjectName").value.trim(),
      weekday:Number($("#weekday").value),start_time:$("#startTime").value,end_time:$("#endTime").value,active:true
    };
    if(item.end_time<=item.start_time)return toast("Giờ kết thúc phải sau giờ bắt đầu");
    await store.upsertSchedule(item); schedules=await store.getSchedules(); $("#scheduleDialog").close(); renderAll(); toast("Đã lưu lịch");
  });

  $("#historyMonth").addEventListener("change",renderHistory);
  $("#historyStatus").addEventListener("change",renderHistory);

  $("#exportBtn").onclick=async()=>{
    const data=await store.exportData(); const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`teaching-attendance-backup-${fmtDate(new Date())}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $("#importInput").addEventListener("change",async e=>{
    const file=e.target.files[0]; if(!file)return;
    try{const data=JSON.parse(await file.text()); await store.importData(data); await load(); toast("Đã nhập dữ liệu");}
    catch(err){toast("File JSON không hợp lệ");}
    e.target.value="";
  });
  $("#seedBtn").onclick=async()=>{await seedIfEmpty(false); await load();};

  $$("[data-close-dialog]").forEach(b=>b.onclick=()=>$("#"+b.dataset.closeDialog).close());

  async function start(){
    $("#historyMonth").value=fmtDate(new Date()).slice(0,7);
    await initBackend(); await load();
    if("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
  start().catch(err=>{console.error(err);toast("Có lỗi: "+err.message);});
})();
