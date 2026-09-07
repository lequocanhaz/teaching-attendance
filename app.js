(() => {
  const DAY_NAMES = {1:"Thứ 2",2:"Thứ 3",3:"Thứ 4",4:"Thứ 5",5:"Thứ 6",6:"Thứ 7",7:"Chủ nhật"};
  const TYPE = {
    teaching:{label:"Dạy thêm", icon:"👨‍🏫"},
    university:{label:"Lịch học", icon:"🎓"},
    practicum:{label:"Kiến tập / Thực tập", icon:"🏫"}
  };
  const STATUS = {
    pending:["Chưa dạy","pending"], taught:["Đã dạy","taught"], student_absent:["Học sinh nghỉ","student_absent"],
    teacher_absent:["Giáo viên nghỉ","teacher_absent"], makeup:["Dạy bù","makeup"], cancelled:["Hủy buổi","cancelled"]
  };
  const TEACHING_SEED = [
    ["Nam","VL12",2,"09:00","10:30"],["Nam","VL12",6,"09:00","10:30"],["Nam","VL12",7,"09:00","10:30"],
    ["Đức","VL12",2,"19:30","21:00"],["Đức","VL12",4,"19:30","21:00"],["Đức","VL12",6,"19:30","21:00"],
    ["Phát","VL10",5,"09:30","11:00"],["Phát","VL10",7,"14:00","15:30"],
    ["Đạt","VL10",1,"18:00","19:30"],["Đạt","VL10",5,"18:00","19:30"],
    ["Triết","VL11",3,"16:00","17:30"],["Triết","VL11",5,"15:00","16:30"]
  ];
  const UNIVERSITY_SEED = [
    ["Kiểm tra đánh giá trong dạy học Vật lí","",2,"13:00","15:35","A5-404A"],
    ["Thực hành dạy học Vật lí","",3,"07:50","09:35","A5-404A"],
    ["Quản lí Nhà nước về giáo dục","",4,"07:00","09:35","A1-102"],
    ["Vật lí thống kê","",4,"09:40","12:15","A1-101"]
  ];

  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random().toString(16).slice(2);
  const pad = n => String(n).padStart(2,"0");
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
  const weekday = s => { const n=parseDate(s).getDay(); return n===0?7:n; };
  const viDate = s => parseDate(s).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  const esc = s => String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = msg => { const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove("show"),1800); };
  const normalizeSchedule = s => ({schedule_type:"teaching",location:"",start_date:null,end_date:null,...s});
  const inDateRange = (s,date) => (!s.start_date || date>=s.start_date) && (!s.end_date || date<=s.end_date);
  const statusLabel = st => STATUS[st]?.[0] || st;
  const typeLabel = t => TYPE[t]?.label || "Lịch";

  class LocalStore {
    constructor(){ this.sKey="qa_schedules_v1"; this.xKey="qa_sessions_v1"; }
    schedules(){ return JSON.parse(localStorage.getItem(this.sKey)||"[]").map(normalizeSchedule); }
    sessions(){ return JSON.parse(localStorage.getItem(this.xKey)||"[]"); }
    saveSchedules(v){ localStorage.setItem(this.sKey,JSON.stringify(v)); }
    saveSessions(v){ localStorage.setItem(this.xKey,JSON.stringify(v)); }
    async getSchedules(){ return this.schedules().filter(x=>x.active!==false); }
    async upsertSchedule(x){ const a=this.schedules(),i=a.findIndex(v=>v.id===x.id),item=normalizeSchedule({...x,id:x.id||uid(),active:x.active!==false}); if(i>=0)a[i]={...a[i],...item}; else a.push(item); this.saveSchedules(a); }
    async deleteSchedule(id){ const a=this.schedules(),i=a.findIndex(v=>v.id===id); if(i>=0){a[i].active=false;this.saveSchedules(a);} }
    async getSessions(){ return this.sessions(); }
    async upsertSession(x){ const a=this.sessions(),i=a.findIndex(v=>v.key===x.key),rec={...x,id:x.id||uid(),updated_at:new Date().toISOString()}; if(i>=0)a[i]={...a[i],...rec}; else a.push(rec); this.saveSessions(a); }
    async importData(data){ if(data.schedules)this.saveSchedules(data.schedules.map(normalizeSchedule)); if(data.sessions)this.saveSessions(data.sessions); }
    async exportData(){ return {schedules:this.schedules(),sessions:this.sessions()}; }
  }

  class SupabaseStore {
    constructor(client){this.client=client;}
    async getSchedules(){ const {data,error}=await this.client.from("schedules").select("*").eq("active",true).order("weekday").order("start_time"); if(error)throw error; return (data||[]).map(normalizeSchedule); }
    async upsertSchedule(x){
      const p={id:x.id||undefined,schedule_type:x.schedule_type||"teaching",student_name:x.student_name,subject:x.subject||"",location:x.location||"",weekday:Number(x.weekday),start_time:x.start_time,end_time:x.end_time,start_date:x.start_date||null,end_date:x.end_date||null,active:x.active!==false};
      if(!p.id)delete p.id; const {error}=await this.client.from("schedules").upsert(p); if(error)throw error;
    }
    async deleteSchedule(id){const {error}=await this.client.from("schedules").update({active:false}).eq("id",id);if(error)throw error;}
    async getSessions(){const {data,error}=await this.client.from("sessions").select("*").order("session_date",{ascending:false});if(error)throw error;return(data||[]).map(x=>({...x,key:`${x.schedule_id||"custom"}|${x.original_date}`}));}
    async upsertSession(x){const p={schedule_id:x.schedule_id||null,original_date:x.original_date,session_date:x.session_date,start_time:x.start_time,end_time:x.end_time,student_name:x.student_name,subject:x.subject,status:x.status,note:x.note||""};const {error}=await this.client.from("sessions").upsert(p,{onConflict:"user_id,schedule_id,original_date"});if(error)throw error;}
    async exportData(){return{schedules:await this.getSchedules(),sessions:await this.getSessions()};}
    async importData(data){for(const s of(data.schedules||[]))await this.upsertSchedule({...s,id:undefined});for(const x of(data.sessions||[]))await this.upsertSession({...x,id:undefined});}
  }

  let store=new LocalStore(),supabaseClient=null,cloudMode=false,schedules=[],sessions=[],selectedDate=fmtDate(new Date()),scheduleFilter="all";
  const configured=()=>window.APP_CONFIG?.SUPABASE_URL&&window.APP_CONFIG?.SUPABASE_ANON_KEY;

  async function initBackend(){
    if(!configured()){ $("#cloudBadge").textContent="Dữ liệu cục bộ"; return; }
    supabaseClient=window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL,window.APP_CONFIG.SUPABASE_ANON_KEY);
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(session){store=new SupabaseStore(supabaseClient);cloudMode=true;$("#cloudBadge").textContent="Supabase • Đã đăng nhập";} else $("#cloudBadge").textContent="Supabase • Chưa đăng nhập";
  }

  const sameSchedule=(a,b)=>a.schedule_type===b.schedule_type&&a.student_name===b.student_name&&Number(a.weekday)===Number(b.weekday)&&a.start_time.slice(0,5)===b.start_time.slice(0,5);
  async function seedMissing(silent=false){
    const current=await store.getSchedules(); let added=0;
    for(const [student_name,subject,wd,start_time,end_time] of TEACHING_SEED){
      const item=normalizeSchedule({id:uid(),schedule_type:"teaching",student_name,subject,weekday:wd,start_time,end_time,active:true});
      if(!current.some(s=>sameSchedule(s,item))){await store.upsertSchedule(item);current.push(item);added++;}
    }
    for(const [student_name,subject,wd,start_time,end_time,location] of UNIVERSITY_SEED){
      const item=normalizeSchedule({id:uid(),schedule_type:"university",student_name,subject,location,weekday:wd,start_time,end_time,active:true});
      if(!current.some(s=>sameSchedule(s,item))){await store.upsertSchedule(item);current.push(item);added++;}
    }
    if(!silent)toast(added?`Đã bổ sung ${added} lịch mẫu`:"Lịch mẫu đã đầy đủ");
  }

  async function load(){
    schedules=await store.getSchedules();sessions=await store.getSessions();
    if(!schedules.length&&!cloudMode)await seedMissing(true);
    else if(!cloudMode && !localStorage.getItem("qa_schedule_types_migrated_v2")){ await seedMissing(true); localStorage.setItem("qa_schedule_types_migrated_v2","1"); }
    schedules=await store.getSchedules();sessions=await store.getSessions();renderAll();
  }

  function teachingOccurrences(date){
    const wd=weekday(date);
    const movedFrom=new Set(sessions.filter(x=>x.original_date===date&&x.session_date!==date).map(x=>x.schedule_id));
    const regular=schedules.filter(s=>s.schedule_type==="teaching"&&Number(s.weekday)===wd&&inDateRange(s,date)&&!movedFrom.has(s.id)).map(s=>{
      const key=`${s.id}|${date}`; const rec=sessions.find(x=>x.key===key||(x.schedule_id===s.id&&x.original_date===date));
      return rec||{key,schedule_id:s.id,original_date:date,session_date:date,start_time:s.start_time,end_time:s.end_time,student_name:s.student_name,subject:s.subject,status:"pending",note:"",schedule_type:"teaching",location:s.location||""};
    });
    const movedIn=sessions.filter(x=>x.session_date===date&&x.original_date!==date).map(x=>({...x,schedule_type:"teaching"}));
    return[...regular,...movedIn];
  }

  function otherOccurrences(date){
    const wd=weekday(date);
    return schedules.filter(s=>s.schedule_type!=="teaching"&&Number(s.weekday)===wd&&inDateRange(s,date)).map(s=>({
      key:`schedule-${s.id}-${date}`,schedule_id:s.id,session_date:date,original_date:date,start_time:s.start_time,end_time:s.end_time,
      student_name:s.student_name,subject:s.subject,location:s.location||"",schedule_type:s.schedule_type,status:null,note:""
    }));
  }
  function occurrencesForDate(date){return[...teachingOccurrences(date),...otherOccurrences(date)].sort((a,b)=>a.start_time.localeCompare(b.start_time));}

  function renderToday(){
    $("#todayDate").value=selectedDate;$("#todayLabel").textContent=viDate(selectedDate);
    const list=occurrencesForDate(selectedDate),teaching=list.filter(x=>x.schedule_type==="teaching"),taught=teaching.filter(x=>["taught","makeup"].includes(x.status)).length,pending=teaching.filter(x=>x.status==="pending").length;
    $("#todaySummary").innerHTML=[["Tổng lịch",list.length],["Ca dạy",teaching.length],["Đã dạy",taught],["Chưa chấm",pending]].map(([l,n])=>`<div class="summary-card"><div class="num">${n}</div><div class="label">${l}</div></div>`).join("");
    $("#todaySessions").innerHTML=list.length?list.map(x=>{
      const type=x.schedule_type||"teaching",isTeaching=type==="teaching";
      return `<article class="session-card type-${type}">
        <div class="session-top"><div>
          <div class="type-tag ${type}">${TYPE[type]?.icon||"•"} ${typeLabel(type)}</div>
          <div class="session-title">${esc(x.student_name)}${isTeaching&&x.subject?` · ${esc(x.subject)}`:""}</div>
          ${!isTeaching&&x.subject?`<div class="muted">${esc(x.subject)}</div>`:""}
          <div class="session-time">${esc(x.start_time.slice(0,5))}–${esc(x.end_time.slice(0,5))}</div>
          ${x.location?`<div class="location">📍 ${esc(x.location)}</div>`:""}
          ${isTeaching&&x.original_date!==x.session_date?`<div class="muted">Đã chuyển từ ${esc(x.original_date.split("-").reverse().join("/"))}</div>`:""}
          ${x.note?`<div class="muted note-line">${esc(x.note)}</div>`:""}
        </div>${isTeaching?`<span class="status-pill ${esc(x.status)}">${statusLabel(x.status)}</span>`:""}</div>
        ${isTeaching?`<div class="session-actions">
          ${["taught","student_absent","teacher_absent","makeup"].map(st=>`<button class="status-btn ${x.status===st?"active":""}" data-status="${st}" data-key="${esc(x.key)}">${statusLabel(st)}</button>`).join("")}
          <button class="ghost" data-reschedule="${esc(x.key)}">Đổi lịch buổi này</button><button class="ghost" data-note="${esc(x.key)}">Ghi chú</button><button class="ghost" data-status="cancelled" data-key="${esc(x.key)}">Hủy buổi</button>
        </div>`:""}
      </article>`;
    }).join(""):`<div class="empty">Không có lịch nào trong ngày này.</div>`;
  }

  function rangeText(s){ if(!s.start_date&&!s.end_date)return""; if(s.start_date&&s.end_date)return`${s.start_date.split("-").reverse().join("/")} → ${s.end_date.split("-").reverse().join("/")}`; return s.start_date?`Từ ${s.start_date.split("-").reverse().join("/")}`:`Đến ${s.end_date.split("-").reverse().join("/")}`; }
  function renderSchedule(){
    const grouped={};for(let i=1;i<=7;i++)grouped[i]=[];
    schedules.filter(s=>scheduleFilter==="all"||s.schedule_type===scheduleFilter).forEach(s=>grouped[Number(s.weekday)].push(s));
    Object.values(grouped).forEach(a=>a.sort((x,y)=>x.start_time.localeCompare(y.start_time)));
    $("#weeklyGrid").innerHTML=Object.entries(grouped).map(([d,items])=>`<div class="day-column"><div class="day-title">${DAY_NAMES[d]}</div>
      ${items.map(s=>`<div class="schedule-card type-${s.schedule_type}">
        <div class="type-tag ${s.schedule_type}">${TYPE[s.schedule_type]?.icon||"•"} ${typeLabel(s.schedule_type)}</div>
        <div class="name">${esc(s.student_name)}</div>${s.subject?`<div class="sub">${esc(s.subject)}</div>`:""}
        <div class="time">${esc(s.start_time.slice(0,5))}–${esc(s.end_time.slice(0,5))}</div>
        ${s.location?`<div class="location small-text">📍 ${esc(s.location)}</div>`:""}${rangeText(s)?`<div class="date-range">${esc(rangeText(s))}</div>`:""}
        <div class="card-actions"><button class="ghost" data-edit-schedule="${s.id}">Sửa</button><button class="ghost" data-delete-schedule="${s.id}">Xóa</button></div>
      </div>`).join("")||`<div class="muted">Trống</div>`}</div>`).join("");
  }

  function renderHistory(){
    const month=$("#historyMonth").value,status=$("#historyStatus").value;let rows=sessions.filter(x=>x.status&&x.status!=="pending");
    if(month)rows=rows.filter(x=>x.session_date.startsWith(month));if(status)rows=rows.filter(x=>x.status===status);rows.sort((a,b)=>b.session_date.localeCompare(a.session_date)||b.start_time.localeCompare(a.start_time));
    const taught=rows.filter(x=>["taught","makeup"].includes(x.status)).length,absent=rows.filter(x=>["student_absent","teacher_absent","cancelled"].includes(x.status)).length;
    $("#historyStats").innerHTML=[["Ghi nhận",rows.length],["Đã dạy",taught],["Nghỉ / hủy",absent],["Dạy bù",rows.filter(x=>x.status==="makeup").length]].map(([l,n])=>`<div class="summary-card"><div class="num">${n}</div><div class="label">${l}</div></div>`).join("");
    $("#historyBody").innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.session_date.split("-").reverse().join("/"))}</td><td><strong>${esc(x.student_name)}</strong><br><span class="muted">${esc(x.subject)}</span></td><td>${esc(x.start_time.slice(0,5))}–${esc(x.end_time.slice(0,5))}</td><td><span class="status-pill ${esc(x.status)}">${statusLabel(x.status)}</span></td><td>${esc(x.note||"")}</td></tr>`).join(""):`<tr><td colspan="5" class="muted">Chưa có dữ liệu.</td></tr>`;
  }

  async function renderSettings(){
    const area=$("#authArea");if(!configured()){area.innerHTML=`<div class="muted">Chưa cấu hình Supabase. Web đang lưu dữ liệu bằng localStorage.</div>`;return;}
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(session){area.innerHTML=`<div class="auth-box"><strong>${esc(session.user.email)}</strong><button id="logoutBtn" class="ghost">Đăng xuất</button></div>`;$("#logoutBtn").onclick=async()=>{await supabaseClient.auth.signOut();location.reload();};}
    else{area.innerHTML=`<div class="auth-box"><input id="authEmail" type="email" placeholder="Email"/><input id="authPassword" type="password" placeholder="Mật khẩu (tối thiểu 6 ký tự)"/><div class="auth-actions"><button id="loginBtn" class="primary">Đăng nhập</button><button id="signupBtn" class="ghost">Tạo tài khoản</button></div></div>`;$("#loginBtn").onclick=()=>auth("login");$("#signupBtn").onclick=()=>auth("signup");}
  }
  async function auth(mode){const email=$("#authEmail").value.trim(),password=$("#authPassword").value;if(!email||!password)return toast("Nhập email và mật khẩu");const r=mode==="login"?await supabaseClient.auth.signInWithPassword({email,password}):await supabaseClient.auth.signUp({email,password});if(r.error)return toast(r.error.message);toast(mode==="login"?"Đăng nhập thành công":"Đã tạo tài khoản");setTimeout(()=>location.reload(),600);}
  function renderAll(){renderToday();renderSchedule();renderHistory();renderSettings();}

  function getOccurrenceByKey(key){let rec=sessions.find(x=>x.key===key);if(rec)return rec;const[sid,date]=key.split("|");const s=schedules.find(x=>x.id===sid&&x.schedule_type==="teaching");if(!s)return null;return{key,schedule_id:s.id,original_date:date,session_date:date,start_time:s.start_time,end_time:s.end_time,student_name:s.student_name,subject:s.subject,status:"pending",note:""};}
  async function saveOccurrence(x){await store.upsertSession(x);sessions=await store.getSessions();renderAll();}

  $$(".tab").forEach(btn=>btn.addEventListener("click",()=>{$$(".tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");$$(".view").forEach(x=>x.classList.remove("active"));$("#view-"+btn.dataset.view).classList.add("active");}));
  $("#todayDate").addEventListener("change",e=>{selectedDate=e.target.value;renderToday();});
  $("#prevDay").onclick=()=>{const d=parseDate(selectedDate);d.setDate(d.getDate()-1);selectedDate=fmtDate(d);renderToday();};
  $("#nextDay").onclick=()=>{const d=parseDate(selectedDate);d.setDate(d.getDate()+1);selectedDate=fmtDate(d);renderToday();};

  $("#todaySessions").addEventListener("click",async e=>{
    const st=e.target.dataset.status,key=e.target.dataset.key;if(st&&key){const x=getOccurrenceByKey(key);if(!x)return;x.status=st;await saveOccurrence(x);toast(statusLabel(st));return;}
    if(e.target.dataset.reschedule){const x=getOccurrenceByKey(e.target.dataset.reschedule);if(!x)return;$("#rescheduleKey").value=x.key;$("#rescheduleDate").value=x.session_date;$("#rescheduleStart").value=x.start_time.slice(0,5);$("#rescheduleEnd").value=x.end_time.slice(0,5);$("#rescheduleNote").value=x.note||"";$("#rescheduleDialog").showModal();return;}
    if(e.target.dataset.note){const x=getOccurrenceByKey(e.target.dataset.note);if(!x)return;$("#noteKey").value=x.key;$("#sessionNote").value=x.note||"";$("#noteDialog").showModal();}
  });
  $("#rescheduleForm").addEventListener("submit",async e=>{e.preventDefault();const x=getOccurrenceByKey($("#rescheduleKey").value);if(!x)return;x.session_date=$("#rescheduleDate").value;x.start_time=$("#rescheduleStart").value;x.end_time=$("#rescheduleEnd").value;x.note=$("#rescheduleNote").value.trim();await saveOccurrence(x);$("#rescheduleDialog").close();toast("Đã đổi lịch buổi này");});
  $("#noteForm").addEventListener("submit",async e=>{e.preventDefault();const x=getOccurrenceByKey($("#noteKey").value);if(!x)return;x.note=$("#sessionNote").value.trim();await saveOccurrence(x);$("#noteDialog").close();toast("Đã lưu ghi chú");});

  function updateScheduleFormLabels(){const t=$("#scheduleType").value;if(t==="teaching"){$("#titleFieldLabel").textContent="Học sinh";$("#subjectFieldLabel").textContent="Môn / lớp";$("#studentName").placeholder="Ví dụ: Nam";$("#subjectName").placeholder="Ví dụ: VL12";}else if(t==="university"){$("#titleFieldLabel").textContent="Tên môn học";$("#subjectFieldLabel").textContent="Mã học phần / ghi chú";$("#studentName").placeholder="Ví dụ: Vật lí thống kê";$("#subjectName").placeholder="Có thể để trống";}else{$("#titleFieldLabel").textContent="Nội dung / đơn vị";$("#subjectFieldLabel").textContent="Mô tả";$("#studentName").placeholder="Ví dụ: Kiến tập tại THPT ...";$("#subjectName").placeholder="Ví dụ: Dự giờ / chủ nhiệm / giảng dạy";}}
  $("#scheduleType").addEventListener("change",updateScheduleFormLabels);
  $("#addScheduleBtn").onclick=()=>{$("#scheduleDialogTitle").textContent="Thêm lịch";$("#scheduleForm").reset();$("#scheduleId").value="";$("#scheduleType").value="teaching";updateScheduleFormLabels();$("#scheduleDialog").showModal();};
  $$("[data-schedule-filter]").forEach(b=>b.onclick=()=>{scheduleFilter=b.dataset.scheduleFilter;$$("[data-schedule-filter]").forEach(x=>x.classList.toggle("active",x===b));renderSchedule();});

  $("#weeklyGrid").addEventListener("click",async e=>{
    const edit=e.target.dataset.editSchedule,del=e.target.dataset.deleteSchedule;
    if(edit){const s=schedules.find(x=>x.id===edit);if(!s)return;$("#scheduleDialogTitle").textContent="Sửa lịch";$("#scheduleId").value=s.id;$("#scheduleType").value=s.schedule_type;$("#studentName").value=s.student_name;$("#subjectName").value=s.subject||"";$("#locationName").value=s.location||"";$("#weekday").value=s.weekday;$("#startTime").value=s.start_time.slice(0,5);$("#endTime").value=s.end_time.slice(0,5);$("#startDate").value=s.start_date||"";$("#endDate").value=s.end_date||"";updateScheduleFormLabels();$("#scheduleDialog").showModal();}
    if(del&&confirm("Xóa lịch này? Lịch sử chấm công cũ (nếu có) vẫn được giữ.")){await store.deleteSchedule(del);schedules=await store.getSchedules();renderAll();toast("Đã xóa lịch");}
  });
  $("#scheduleForm").addEventListener("submit",async e=>{
    e.preventDefault();const item={id:$("#scheduleId").value||uid(),schedule_type:$("#scheduleType").value,student_name:$("#studentName").value.trim(),subject:$("#subjectName").value.trim(),location:$("#locationName").value.trim(),weekday:Number($("#weekday").value),start_time:$("#startTime").value,end_time:$("#endTime").value,start_date:$("#startDate").value||null,end_date:$("#endDate").value||null,active:true};
    if(item.end_time<=item.start_time)return toast("Giờ kết thúc phải sau giờ bắt đầu");if(item.start_date&&item.end_date&&item.end_date<item.start_date)return toast("Ngày kết thúc phải sau ngày bắt đầu");
    await store.upsertSchedule(item);schedules=await store.getSchedules();$("#scheduleDialog").close();renderAll();toast("Đã lưu lịch");
  });

  $("#historyMonth").addEventListener("change",renderHistory);$("#historyStatus").addEventListener("change",renderHistory);
  $("#exportBtn").onclick=async()=>{const data=await store.exportData(),blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`teaching-attendance-backup-${fmtDate(new Date())}.json`;a.click();URL.revokeObjectURL(a.href);};
  $("#importInput").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{await store.importData(JSON.parse(await file.text()));await load();toast("Đã nhập dữ liệu");}catch(err){toast("File JSON không hợp lệ");}e.target.value="";});
  $("#seedBtn").onclick=async()=>{await seedMissing(false);await load();};
  $$("[data-close-dialog]").forEach(b=>b.onclick=()=>$("#"+b.dataset.closeDialog).close());

  async function start(){$("#historyMonth").value=fmtDate(new Date()).slice(0,7);await initBackend();await load();if("serviceWorker"in navigator)navigator.serviceWorker.register("./service-worker.js").catch(()=>{});}
  start().catch(err=>{console.error(err);toast("Có lỗi: "+err.message);});
})();
