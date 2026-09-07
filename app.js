(() => {
  const DAY_NAMES = {1:"Thứ 2",2:"Thứ 3",3:"Thứ 4",4:"Thứ 5",5:"Thứ 6",6:"Thứ 7",7:"Chủ nhật"};
  const TYPE = {
    teaching:{label:"Dạy thêm",icon:"👨‍🏫"},
    university:{label:"Lịch học",icon:"🎓"},
    practicum:{label:"Kiến tập / Thực tập",icon:"🏫"}
  };
  const STATUS = {
    pending:"Chưa dạy", taught:"Đã dạy", student_absent:"Học sinh nghỉ",
    teacher_absent:"Giáo viên nghỉ", makeup:"Dạy bù", cancelled:"Hủy buổi"
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

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random().toString(16).slice(2);
  const pad = n => String(n).padStart(2,"0");
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
  const addDays = (dateStr, days) => { const d=parseDate(dateStr); d.setDate(d.getDate()+days); return fmtDate(d); };
  const weekday = s => { const n=parseDate(s).getDay(); return n===0?7:n; };
  const mondayOf = input => {
    const d = typeof input === "string" ? parseDate(input) : new Date(input);
    const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return fmtDate(d);
  };
  const esc = s => String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const viDate = s => parseDate(s).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  const shortDate = s => parseDate(s).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"});
  const toast = msg => { const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove("show"),1900); };
  const configured = () => !!(window.APP_CONFIG?.SUPABASE_URL && window.APP_CONFIG?.SUPABASE_ANON_KEY);
  const inRange = (s,date) => (!s.start_date || date>=s.start_date) && (!s.end_date || date<=s.end_date);
  const timeToMinutes = t => { const [h,m]=String(t).slice(0,5).split(":").map(Number); return h*60+m; };
  const currentDate = () => fmtDate(new Date());
  const currentMinutes = () => new Date().getHours()*60 + new Date().getMinutes();
  const typeLabel = t => TYPE[t]?.label || "Lịch";
  const markSaved = () => { const el=$("#saveStatus"); if(el) el.textContent=`Đã lưu • ${new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`; };

  function timeState(item,date){
    const today=currentDate();
    if(date<today) return {key:"past",label:"Đã qua"};
    if(date>today) return {key:"upcoming",label:"Sắp tới"};
    const now=currentMinutes(), start=timeToMinutes(item.start_time), end=timeToMinutes(item.end_time);
    if(now<start) return {key:"upcoming",label:"Sắp tới"};
    if(now<=end) return {key:"now",label:"Đang diễn ra"};
    return {key:"past",label:"Đã qua"};
  }

  class LocalStore {
    constructor(){ this.sKey="qa_schedules_v1"; this.xKey="qa_sessions_v1"; this.wKey="qa_week_events_v1"; this.eKey="qa_schedule_exceptions_v1"; }
    rawSchedules(){ return JSON.parse(localStorage.getItem(this.sKey)||"[]"); }
    rawSessions(){ return JSON.parse(localStorage.getItem(this.xKey)||"[]"); }
    rawWeekly(){ return JSON.parse(localStorage.getItem(this.wKey)||"[]"); }
    rawExceptions(){ return JSON.parse(localStorage.getItem(this.eKey)||"[]"); }
    saveSchedules(v){ localStorage.setItem(this.sKey,JSON.stringify(v)); }
    saveSessions(v){ localStorage.setItem(this.xKey,JSON.stringify(v)); }
    saveWeekly(v){ localStorage.setItem(this.wKey,JSON.stringify(v)); }
    saveExceptions(v){ localStorage.setItem(this.eKey,JSON.stringify(v)); }
    async migrateLegacy(){
      const schedules=this.rawSchedules();
      const legacy=schedules.filter(x=>x.active!==false && x.schedule_type==="practicum");
      if(!legacy.length) return;
      const weekly=this.rawWeekly(); const week=mondayOf(new Date());
      for(const s of legacy){
        const eventDate=addDays(week,Number(s.weekday)-1);
        const exists=weekly.some(e=>e.legacy_schedule_id===s.id);
        if(!exists) weekly.push({id:uid(),event_type:s.schedule_type,event_date:eventDate,title:s.student_name||s.subject||"Lịch",details:s.subject||"",location:s.location||"",start_time:s.start_time,end_time:s.end_time,note:"Được chuyển từ bản lịch cũ",legacy_schedule_id:s.id,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
        s.active=false;
      }
      this.saveWeekly(weekly); this.saveSchedules(schedules);
    }
    async getTeachingSchedules(){ return this.rawSchedules().filter(x=>x.active!==false && (!x.schedule_type || x.schedule_type==="teaching")); }
    async upsertTeachingSchedule(x){
      const a=this.rawSchedules(), i=a.findIndex(v=>v.id===x.id); const rec={...x,schedule_type:"teaching",active:x.active!==false};
      if(i>=0)a[i]={...a[i],...rec}; else a.push({...rec,id:x.id||uid()}); this.saveSchedules(a);
    }
    async endTeachingSchedule(id,effectiveDate){
      const a=this.rawSchedules(), i=a.findIndex(v=>v.id===id); if(i<0)return;
      const end=addDays(effectiveDate,-1);
      if(a[i].start_date && end<a[i].start_date) a[i].active=false; else a[i].end_date=end;
      this.saveSchedules(a);
    }
    async getUniversitySchedules(){ return this.rawSchedules().filter(x=>x.active!==false && x.schedule_type==="university"); }
    async upsertUniversitySchedule(x){
      const a=this.rawSchedules(), i=a.findIndex(v=>v.id===x.id); const rec={...x,schedule_type:"university",active:x.active!==false};
      if(i>=0)a[i]={...a[i],...rec}; else a.push({...rec,id:x.id||uid()}); this.saveSchedules(a);
    }
    async endUniversitySchedule(id,effectiveDate){
      const a=this.rawSchedules(), i=a.findIndex(v=>v.id===id); if(i<0)return; const end=addDays(effectiveDate,-1);
      if(a[i].start_date && end<a[i].start_date) a[i].active=false; else a[i].end_date=end; this.saveSchedules(a);
    }
    async getScheduleExceptions(){ return this.rawExceptions(); }
    async upsertScheduleException(x){
      const a=this.rawExceptions(), i=a.findIndex(v=>v.schedule_id===x.schedule_id && v.event_date===x.event_date); const rec={...x,id:x.id||uid(),updated_at:new Date().toISOString()};
      if(i>=0)a[i]={...a[i],...rec}; else a.push(rec); this.saveExceptions(a);
    }
    async deleteScheduleException(scheduleId,eventDate){ this.saveExceptions(this.rawExceptions().filter(x=>!(x.schedule_id===scheduleId&&x.event_date===eventDate))); }
    async getSessions(){ return this.rawSessions(); }
    async upsertSession(x){
      const a=this.rawSessions(), i=a.findIndex(v=>v.key===x.key || (v.schedule_id===x.schedule_id && v.original_date===x.original_date));
      const rec={...x,id:x.id||uid(),updated_at:new Date().toISOString()}; if(i>=0)a[i]={...a[i],...rec}; else a.push(rec); this.saveSessions(a);
    }
    async getWeeklyEvents(){ return this.rawWeekly(); }
    async upsertWeeklyEvent(x){
      const a=this.rawWeekly(), i=a.findIndex(v=>v.id===x.id); const rec={...x,id:x.id||uid(),updated_at:new Date().toISOString(),created_at:x.created_at||new Date().toISOString()};
      if(i>=0)a[i]={...a[i],...rec}; else a.push(rec); this.saveWeekly(a);
    }
    async deleteWeeklyEvent(id){ this.saveWeekly(this.rawWeekly().filter(x=>x.id!==id)); }
    async exportData(){ return {version:4,schedules:this.rawSchedules(),sessions:this.rawSessions(),weekly_events:this.rawWeekly(),schedule_exceptions:this.rawExceptions()}; }
    async importData(data){
      if(data.schedules)this.saveSchedules(data.schedules); if(data.sessions)this.saveSessions(data.sessions);
      if(data.weekly_events)this.saveWeekly(data.weekly_events);
      if(data.schedule_exceptions)this.saveExceptions(data.schedule_exceptions);
    }
  }

  class SupabaseStore {
    constructor(client){ this.client=client; }
    async migrateLegacy(){}
    async getTeachingSchedules(){
      const {data,error}=await this.client.from("schedules").select("*").eq("active",true).order("weekday").order("start_time");
      if(error)throw error; return (data||[]).filter(x=>!x.schedule_type || x.schedule_type==="teaching");
    }
    async upsertTeachingSchedule(x){
      const payload={id:x.id||undefined,schedule_type:"teaching",student_name:x.student_name,subject:x.subject||"",location:x.location||"",weekday:Number(x.weekday),start_time:x.start_time,end_time:x.end_time,start_date:x.start_date||null,end_date:x.end_date||null,active:x.active!==false};
      if(!payload.id)delete payload.id; const {error}=await this.client.from("schedules").upsert(payload); if(error)throw error;
    }
    async endTeachingSchedule(id,effectiveDate){
      const old=teachingSchedules.find(x=>x.id===id); if(!old)return; const end=addDays(effectiveDate,-1);
      const patch=(old.start_date && end<old.start_date)?{active:false}:{end_date:end};
      const {error}=await this.client.from("schedules").update(patch).eq("id",id); if(error)throw error;
    }
    async getUniversitySchedules(){
      const {data,error}=await this.client.from("schedules").select("*").eq("active",true).eq("schedule_type","university").order("weekday").order("start_time");
      if(error)throw error; return data||[];
    }
    async upsertUniversitySchedule(x){
      const payload={id:x.id||undefined,schedule_type:"university",student_name:x.student_name,subject:x.subject||"",location:x.location||"",weekday:Number(x.weekday),start_time:x.start_time,end_time:x.end_time,start_date:x.start_date||null,end_date:x.end_date||null,active:x.active!==false};
      if(!payload.id)delete payload.id; const {error}=await this.client.from("schedules").upsert(payload); if(error)throw error;
    }
    async endUniversitySchedule(id,effectiveDate){
      const old=universitySchedules.find(x=>x.id===id); if(!old)return; const end=addDays(effectiveDate,-1); const patch=(old.start_date&&end<old.start_date)?{active:false}:{end_date:end};
      const {error}=await this.client.from("schedules").update(patch).eq("id",id); if(error)throw error;
    }
    async getScheduleExceptions(){
      const {data,error}=await this.client.from("schedule_exceptions").select("*").order("event_date"); if(error)throw new Error("Cần chạy lại supabase.sql bản V4 trước khi dùng: "+error.message); return data||[];
    }
    async upsertScheduleException(x){
      const payload={schedule_id:x.schedule_id,event_date:x.event_date,action:x.action||"cancelled",note:x.note||""};
      const {error}=await this.client.from("schedule_exceptions").upsert(payload,{onConflict:"user_id,schedule_id,event_date"}); if(error)throw error;
    }
    async deleteScheduleException(scheduleId,eventDate){ const {error}=await this.client.from("schedule_exceptions").delete().eq("schedule_id",scheduleId).eq("event_date",eventDate); if(error)throw error; }
    async getSessions(){
      const {data,error}=await this.client.from("sessions").select("*").order("session_date",{ascending:false}); if(error)throw error;
      return (data||[]).map(x=>({...x,key:`${x.schedule_id||"custom"}|${x.original_date}`}));
    }
    async upsertSession(x){
      const payload={schedule_id:x.schedule_id||null,original_date:x.original_date,session_date:x.session_date,start_time:x.start_time,end_time:x.end_time,student_name:x.student_name,subject:x.subject,status:x.status,note:x.note||""};
      const {error}=await this.client.from("sessions").upsert(payload,{onConflict:"user_id,schedule_id,original_date"}); if(error)throw error;
    }
    async getWeeklyEvents(){
      const {data,error}=await this.client.from("weekly_events").select("*").order("event_date").order("start_time");
      if(error)throw new Error("Cần chạy lại supabase.sql bản V3 trước khi dùng: "+error.message); return data||[];
    }
    async upsertWeeklyEvent(x){
      const payload={id:x.id||undefined,event_type:x.event_type,event_date:x.event_date,title:x.title,details:x.details||"",location:x.location||"",start_time:x.start_time,end_time:x.end_time,note:x.note||""};
      if(!payload.id)delete payload.id; const {error}=await this.client.from("weekly_events").upsert(payload); if(error)throw error;
    }
    async deleteWeeklyEvent(id){ const {error}=await this.client.from("weekly_events").delete().eq("id",id); if(error)throw error; }
    async exportData(){ return {version:4,schedules:[...await this.getTeachingSchedules(),...await this.getUniversitySchedules()],sessions:await this.getSessions(),weekly_events:await this.getWeeklyEvents(),schedule_exceptions:await this.getScheduleExceptions()}; }
    async importData(data){
      for(const s of (data.schedules||[])){ if(!s.schedule_type||s.schedule_type==="teaching") await this.upsertTeachingSchedule({...s,id:undefined}); else if(s.schedule_type==="university") await this.upsertUniversitySchedule({...s,id:undefined}); }
      for(const x of (data.sessions||[])) await this.upsertSession({...x,id:undefined});
      for(const e of (data.weekly_events||[])) await this.upsertWeeklyEvent({...e,id:undefined});
      for(const ex of (data.schedule_exceptions||[])) await this.upsertScheduleException(ex);
    }
  }

  let store=new LocalStore(), supabaseClient=null, cloudMode=false, realtimeChannel=null;
  let teachingSchedules=[], universitySchedules=[], sessions=[], weeklyEvents=[], scheduleExceptions=[];
  let selectedDate=currentDate(), selectedWeekStart=mondayOf(new Date()), scheduleFilter="all";

  async function initBackend(){
    if(!configured()){ $("#cloudBadge").textContent="Dữ liệu cục bộ"; return; }
    supabaseClient=window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL,window.APP_CONFIG.SUPABASE_ANON_KEY);
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(session){ store=new SupabaseStore(supabaseClient); cloudMode=true; $("#cloudBadge").textContent="Supabase • Đã đăng nhập"; setupRealtime(); }
    else $("#cloudBadge").textContent="Supabase • Chưa đăng nhập";
  }

  function setupRealtime(){
    if(!supabaseClient||realtimeChannel)return;
    let timer;
    const refresh=()=>{ clearTimeout(timer); timer=setTimeout(()=>loadAll(false),250); };
    realtimeChannel=supabaseClient.channel("teaching-attendance-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"schedules"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"sessions"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"weekly_events"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"schedule_exceptions"},refresh)
      .subscribe();
  }

  async function loadAll(seed=true){
    await store.migrateLegacy();
    teachingSchedules=await store.getTeachingSchedules(); universitySchedules=await store.getUniversitySchedules(); sessions=await store.getSessions(); weeklyEvents=await store.getWeeklyEvents(); scheduleExceptions=await store.getScheduleExceptions();
    if(seed){ if(!teachingSchedules.length) await seedTeaching(true); if(!universitySchedules.length) await seedUniversity(true); teachingSchedules=await store.getTeachingSchedules(); universitySchedules=await store.getUniversitySchedules(); }
    renderAll();
  }

  async function seedTeaching(silent=false){
    const current=await store.getTeachingSchedules();
    const signatures=new Set(current.map(s=>`${s.student_name}|${s.subject}|${s.weekday}|${String(s.start_time).slice(0,5)}`));
    let added=0;
    for(const [student_name,subject,wd,start_time,end_time] of TEACHING_SEED){
      const sig=`${student_name}|${subject}|${wd}|${start_time}`; if(signatures.has(sig))continue;
      await store.upsertTeachingSchedule({id:uid(),student_name,subject,location:"",weekday:wd,start_time,end_time,start_date:null,end_date:null,active:true}); added++;
    }
    if(!silent)toast(added?`Đã thêm ${added} lịch dạy mẫu`:"Lịch dạy mẫu đã có đủ");
  }

  async function seedUniversity(silent=false){
    const current=await store.getUniversitySchedules(); const signatures=new Set(current.map(s=>`${s.student_name}|${s.weekday}|${String(s.start_time).slice(0,5)}`)); let added=0; const effective=mondayOf(new Date());
    for(const [student_name,subject,wd,start_time,end_time,location] of UNIVERSITY_SEED){ const sig=`${student_name}|${wd}|${start_time}`; if(signatures.has(sig))continue; await store.upsertUniversitySchedule({id:uid(),student_name,subject,location,weekday:wd,start_time,end_time,start_date:effective,end_date:null,active:true}); added++; }
    if(!silent)toast(added?`Đã thêm ${added} môn học cố định`:"Lịch học mẫu đã có đủ");
  }

  function teachingForDate(date){
    const wd=weekday(date);
    const movedFrom=new Set(sessions.filter(x=>x.original_date===date && x.session_date!==date).map(x=>x.schedule_id));
    const regular=teachingSchedules.filter(s=>Number(s.weekday)===wd && inRange(s,date) && !movedFrom.has(s.id)).map(s=>{
      const key=`${s.id}|${date}`;
      const rec=sessions.find(x=>x.schedule_id===s.id && x.original_date===date);
      return rec?{...rec,key,type:"teaching",location:s.location||""}:{key,schedule_id:s.id,original_date:date,session_date:date,start_time:s.start_time,end_time:s.end_time,student_name:s.student_name,subject:s.subject,location:s.location||"",status:"pending",note:"",type:"teaching"};
    });
    const movedIn=sessions.filter(x=>x.session_date===date && x.original_date!==date).map(x=>({...x,key:x.key||`${x.schedule_id}|${x.original_date}`,type:"teaching",location:teachingSchedules.find(s=>s.id===x.schedule_id)?.location||""}));
    return [...regular,...movedIn];
  }

  function universityForDate(date){
    const wd=weekday(date);
    return universitySchedules.filter(s=>Number(s.weekday)===wd && inRange(s,date) && !scheduleExceptions.some(ex=>ex.schedule_id===s.id&&ex.event_date===date&&ex.action==="cancelled")).map(s=>({id:`rec-${s.id}-${date}`,recurring_id:s.id,type:"university",event_type:"university",event_date:date,title:s.student_name,details:s.subject||"",location:s.location||"",start_time:s.start_time,end_time:s.end_time,note:"",is_recurring:true}));
  }
  function eventsForDate(date){
    const recurring=universitySchedules.filter(s=>Number(s.weekday)===weekday(date)&&inRange(s,date));
    return weeklyEvents.filter(e=>e.event_date===date).filter(e=>!(e.event_type==="university"&&recurring.some(s=>s.student_name===e.title&&String(s.start_time).slice(0,5)===String(e.start_time).slice(0,5)))).map(e=>({...e,type:e.event_type,is_recurring:false}));
  }
  function itemsForDate(date){ return [...teachingForDate(date),...universityForDate(date),...eventsForDate(date)].sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time))); }
  function getTeachingOccurrence(key){
    let rec=sessions.find(x=>(x.key||`${x.schedule_id}|${x.original_date}`)===key); if(rec)return {...rec,key,type:"teaching"};
    const [sid,date]=key.split("|"); const s=teachingSchedules.find(x=>x.id===sid); if(!s)return null;
    return {key,schedule_id:s.id,original_date:date,session_date:date,start_time:s.start_time,end_time:s.end_time,student_name:s.student_name,subject:s.subject,location:s.location||"",status:"pending",note:"",type:"teaching"};
  }

  function renderClock(){
    const now=new Date(); $("#liveTime").textContent=now.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
    $("#liveDate").textContent=now.toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  }

  function renderToday(){
    $("#todayDate").value=selectedDate; $("#todayLabel").textContent=viDate(selectedDate);
    const list=itemsForDate(selectedDate); const teaching=list.filter(x=>x.type==="teaching");
    const counts={all:list.length,teaching:teaching.length,taught:teaching.filter(x=>["taught","makeup"].includes(x.status)).length,pending:teaching.filter(x=>x.status==="pending").length};
    $("#todaySummary").innerHTML=[["Tổng lịch",counts.all],["Ca dạy",counts.teaching],["Đã dạy",counts.taught],["Chưa chấm",counts.pending]].map(([l,n])=>`<div class="summary-card"><div class="num">${n}</div><div class="label">${l}</div></div>`).join("");
    $("#todaySessions").innerHTML=list.length?list.map(x=>{
      const ts=timeState(x,selectedDate), isTeaching=x.type==="teaching";
      return `<article class="session-card type-${esc(x.type)} ${ts.key==="now"?"is-now":""}">
        <div class="session-top"><div>
          <span class="type-tag ${esc(x.type)}">${TYPE[x.type]?.icon||"•"} ${typeLabel(x.type)}</span>
          <div class="session-title">${isTeaching?`${esc(x.student_name)} · ${esc(x.subject)}`:esc(x.title)}</div>
          ${!isTeaching&&x.details?`<div class="muted small-text">${esc(x.details)}</div>`:""}
          <div class="session-time">${esc(String(x.start_time).slice(0,5))}–${esc(String(x.end_time).slice(0,5))}</div>
          ${x.location?`<div class="location">📍 ${esc(x.location)}</div>`:""}
          ${x.original_date&&x.original_date!==x.session_date?`<div class="muted small-text">Đã chuyển từ ${shortDate(x.original_date)}</div>`:""}
          ${x.note?`<div class="muted note-line">${esc(x.note)}</div>`:""}
        </div><div class="right-pills">
          <span class="time-pill ${ts.key}">${ts.label}</span>
          ${isTeaching?`<span class="status-pill ${esc(x.status)}">${STATUS[x.status]||x.status}</span>`:""}
        </div></div>
        ${isTeaching?`<div class="session-actions">
          ${["taught","student_absent","teacher_absent","makeup"].map(st=>`<button class="status-btn ${x.status===st?"active":""}" data-status="${st}" data-key="${esc(x.key)}">${STATUS[st]}</button>`).join("")}
          <button class="ghost" data-reschedule="${esc(x.key)}">Đổi lịch buổi này</button><button class="ghost" data-note="${esc(x.key)}">Ghi chú</button><button class="ghost" data-status="cancelled" data-key="${esc(x.key)}">Hủy buổi</button>
        </div>`: x.is_recurring ? `<div class="session-actions"><button class="ghost" data-skip-university="${esc(x.recurring_id)}" data-event-date="${esc(selectedDate)}">Bỏ lịch tuần này</button></div>` : `<div class="session-actions"><button class="ghost" data-edit-event="${esc(x.id)}">Sửa lịch này</button></div>`}
      </article>`;
    }).join(""):`<div class="empty">Không có lịch nào trong ngày này.</div>`;
  }

  function renderWeek(){
    const end=addDays(selectedWeekStart,6); $("#weekLabel").textContent=`Tuần ${shortDate(selectedWeekStart)} – ${shortDate(end)}/${parseDate(end).getFullYear()}`; $("#jumpWeekDate").value=selectedWeekStart;
    const today=currentDate();
    let html="";
    for(let i=0;i<7;i++){
      const date=addDays(selectedWeekStart,i); let items=itemsForDate(date);
      if(scheduleFilter!=="all")items=items.filter(x=>x.type===scheduleFilter);
      html+=`<div class="day-column ${date===today?"is-today":""}"><div class="day-title"><span>${DAY_NAMES[i+1]}</span><span class="date-no">${shortDate(date)}</span></div>`;
      html+=items.length?items.map(x=>{
        const ts=timeState(x,date), teach=x.type==="teaching";
        return `<div class="schedule-card type-${esc(x.type)} ${ts.key==="now"?"is-now":""}">
          <span class="type-tag ${esc(x.type)}">${TYPE[x.type]?.icon||"•"} ${typeLabel(x.type)}</span>
          <div class="name">${teach?esc(x.student_name):esc(x.title)}</div>
          <div class="sub">${teach?esc(x.subject):esc(x.details||"")}</div>
          <div class="time">${esc(String(x.start_time).slice(0,5))}–${esc(String(x.end_time).slice(0,5))}</div>
          ${x.location?`<div class="location">📍 ${esc(x.location)}</div>`:""}
          ${x.original_date&&x.original_date!==x.session_date?`<div class="small-text muted">Chuyển từ ${shortDate(x.original_date)}</div>`:""}
          ${date===today?`<div style="margin-top:8px"><span class="time-pill ${ts.key}">${ts.label}</span></div>`:""}
          <div class="card-actions">
            ${teach&&x.schedule_id?`<button class="ghost" data-edit-teaching="${esc(x.schedule_id)}" data-effective-date="${esc(date)}">Sửa cố định</button><button class="ghost" data-end-teaching="${esc(x.schedule_id)}" data-effective-date="${esc(date)}">Dừng từ ngày này</button>`:""}
            ${x.type==="university"&&x.is_recurring?`<button class="ghost" data-skip-university="${esc(x.recurring_id)}" data-event-date="${esc(date)}">Bỏ tuần này</button><button class="ghost" data-edit-university="${esc(x.recurring_id)}" data-effective-date="${esc(date)}">Sửa cố định</button><button class="ghost" data-end-university="${esc(x.recurring_id)}" data-effective-date="${esc(date)}">Dừng từ ngày này</button>`:""}
            ${!teach&&!x.is_recurring?`<button class="ghost" data-edit-event="${esc(x.id)}">Sửa</button><button class="ghost" data-delete-event="${esc(x.id)}">Xóa</button>`:""}
          </div>
        </div>`;
      }).join(""):`<div class="muted small-text">Trống</div>`;
      html+="</div>";
    }
    $("#weeklyGrid").innerHTML=html;
    const weekEnd=addDays(selectedWeekStart,6); const hidden=scheduleExceptions.filter(ex=>ex.action==="cancelled"&&ex.event_date>=selectedWeekStart&&ex.event_date<=weekEnd).map(ex=>({...ex,s:universitySchedules.find(s=>s.id===ex.schedule_id)})).filter(x=>x.s);
    const box=$("#hiddenExceptions"); if(box) box.innerHTML=hidden.length?`<div class="hidden-exceptions"><strong>Đã bỏ ${hidden.length} lịch học trong tuần:</strong> ${hidden.map(x=>`<button class="restore-chip" data-restore-university="${esc(x.schedule_id)}" data-event-date="${esc(x.event_date)}">${shortDate(x.event_date)} · ${esc(x.s.student_name)} ↩</button>`).join(" ")}</div>`:"";
  }

  function renderHistory(){
    const month=$("#historyMonth").value, status=$("#historyStatus").value; let rows=sessions.filter(x=>x.status&&x.status!=="pending");
    if(month)rows=rows.filter(x=>x.session_date.startsWith(month)); if(status)rows=rows.filter(x=>x.status===status);
    rows.sort((a,b)=>b.session_date.localeCompare(a.session_date)||String(b.start_time).localeCompare(String(a.start_time)));
    const taught=rows.filter(x=>["taught","makeup"].includes(x.status)).length, absent=rows.filter(x=>["student_absent","teacher_absent","cancelled"].includes(x.status)).length;
    $("#historyStats").innerHTML=[["Ghi nhận",rows.length],["Đã dạy",taught],["Nghỉ / hủy",absent],["Dạy bù",rows.filter(x=>x.status==="makeup").length]].map(([l,n])=>`<div class="summary-card"><div class="num">${n}</div><div class="label">${l}</div></div>`).join("");
    $("#historyBody").innerHTML=rows.length?rows.map(x=>`<tr><td>${shortDate(x.session_date)}/${parseDate(x.session_date).getFullYear()}</td><td><strong>${esc(x.student_name)}</strong><br><span class="muted">${esc(x.subject)}</span></td><td>${esc(String(x.start_time).slice(0,5))}–${esc(String(x.end_time).slice(0,5))}</td><td><span class="status-pill ${esc(x.status)}">${STATUS[x.status]||x.status}</span></td><td>${esc(x.note||"")}</td></tr>`).join(""):`<tr><td colspan="5" class="muted">Chưa có dữ liệu.</td></tr>`;
  }

  async function renderSettings(){
    const area=$("#authArea");
    if(!configured()){ area.innerHTML=`<div class="muted">Chưa cấu hình Supabase. Web đang lưu bằng localStorage trên thiết bị này.</div>`; return; }
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(session){ area.innerHTML=`<div class="auth-box"><strong>${esc(session.user.email)}</strong><div class="muted">Đồng bộ online đang bật.</div><button id="logoutBtn" class="ghost">Đăng xuất</button></div>`; $("#logoutBtn").onclick=async()=>{await supabaseClient.auth.signOut();location.reload();}; }
    else { area.innerHTML=`<div class="auth-box"><input id="authEmail" type="email" placeholder="Email"/><input id="authPassword" type="password" placeholder="Mật khẩu (tối thiểu 6 ký tự)"/><div class="auth-actions"><button id="loginBtn" class="primary">Đăng nhập</button><button id="signupBtn" class="ghost">Tạo tài khoản</button></div></div>`; $("#loginBtn").onclick=()=>auth("login"); $("#signupBtn").onclick=()=>auth("signup"); }
  }

  async function auth(mode){
    const email=$("#authEmail").value.trim(),password=$("#authPassword").value;if(!email||!password)return toast("Nhập email và mật khẩu");
    const res=mode==="login"?await supabaseClient.auth.signInWithPassword({email,password}):await supabaseClient.auth.signUp({email,password}); if(res.error)return toast(res.error.message); toast(mode==="login"?"Đăng nhập thành công":"Đã tạo tài khoản"); setTimeout(()=>location.reload(),700);
  }

  function renderAll(){ renderToday(); renderWeek(); renderHistory(); renderSettings(); }

  async function saveTeachingSession(x){ await store.upsertSession(x); sessions=await store.getSessions(); renderToday();renderWeek();renderHistory();markSaved(); }
  async function saveWeeklyEvent(x){ await store.upsertWeeklyEvent(x); weeklyEvents=await store.getWeeklyEvents(); renderToday();renderWeek();markSaved(); }

  $$(".tab").forEach(btn=>btn.addEventListener("click",()=>{ $$(".tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");$$('.view').forEach(x=>x.classList.remove('active'));$(`#view-${btn.dataset.view}`).classList.add("active"); }));
  $("#todayDate").onchange=e=>{selectedDate=e.target.value;renderToday();};
  $("#prevDay").onclick=()=>{selectedDate=addDays(selectedDate,-1);renderToday();}; $("#nextDay").onclick=()=>{selectedDate=addDays(selectedDate,1);renderToday();}; $("#todayBtn").onclick=()=>{selectedDate=currentDate();renderToday();};
  $("#prevWeek").onclick=()=>{selectedWeekStart=addDays(selectedWeekStart,-7);renderWeek();}; $("#nextWeek").onclick=()=>{selectedWeekStart=addDays(selectedWeekStart,7);renderWeek();}; $("#currentWeekBtn").onclick=()=>{selectedWeekStart=mondayOf(new Date());renderWeek();};
  $("#jumpWeekDate").onchange=e=>{if(e.target.value){selectedWeekStart=mondayOf(e.target.value);renderWeek();}};
  $$('[data-schedule-filter]').forEach(b=>b.onclick=()=>{$$('[data-schedule-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');scheduleFilter=b.dataset.scheduleFilter;renderWeek();});

  $("#addTeachingBtn").onclick=()=>openTeachingDialog();
  function openTeachingDialog(s=null,effectiveDate=currentDate()){
    $("#teachingForm").reset(); $("#teachingId").value=s?.id||""; $("#teachingDialogTitle").textContent=s?"Sửa lịch dạy cố định":"Thêm lịch dạy cố định";
    if(s){$("#teachingStudent").value=s.student_name;$("#teachingSubject").value=s.subject||"";$("#teachingLocation").value=s.location||"";$("#teachingWeekday").value=s.weekday;$("#teachingStart").value=String(s.start_time).slice(0,5);$("#teachingEnd").value=String(s.end_time).slice(0,5);} 
    $("#teachingEffectiveDate").value=effectiveDate; $("#teachingDialog").showModal();
  }
  $("#teachingForm").onsubmit=async e=>{
    e.preventDefault(); const id=$("#teachingId").value, effective=$("#teachingEffectiveDate").value;
    const values={student_name:$("#teachingStudent").value.trim(),subject:$("#teachingSubject").value.trim(),location:$("#teachingLocation").value.trim(),weekday:Number($("#teachingWeekday").value),start_time:$("#teachingStart").value,end_time:$("#teachingEnd").value,start_date:effective,end_date:null,active:true};
    if(values.end_time<=values.start_time)return toast("Giờ kết thúc phải sau giờ bắt đầu");
    if(id){
      const old=teachingSchedules.find(x=>x.id===id); if(!old)return;
      const sameStart=old.start_date===effective;
      if(sameStart){ await store.upsertTeachingSchedule({...old,...values,id}); }
      else { await store.endTeachingSchedule(id,effective); await store.upsertTeachingSchedule({...values,id:uid()}); }
    } else await store.upsertTeachingSchedule({...values,id:uid()});
    teachingSchedules=await store.getTeachingSchedules();$("#teachingDialog").close();renderAll();markSaved();toast("Đã lưu lịch dạy và giữ lịch sử cũ");
  };

  $("#addUniversityBtn").onclick=()=>openUniversityDialog();
  function openUniversityDialog(s=null,effectiveDate=selectedWeekStart){
    $("#universityForm").reset(); $("#universityId").value=s?.id||""; $("#universityDialogTitle").textContent=s?"Sửa môn học cố định":"Thêm môn học cố định";
    if(s){$("#universityTitle").value=s.student_name;$("#universityDetails").value=s.subject||"";$("#universityLocation").value=s.location||"";$("#universityWeekday").value=s.weekday;$("#universityStart").value=String(s.start_time).slice(0,5);$("#universityEnd").value=String(s.end_time).slice(0,5);}
    $("#universityEffectiveDate").value=effectiveDate; $("#universityDialog").showModal();
  }
  $("#universityForm").onsubmit=async e=>{
    e.preventDefault(); const id=$("#universityId").value,effective=$("#universityEffectiveDate").value; const values={student_name:$("#universityTitle").value.trim(),subject:$("#universityDetails").value.trim(),location:$("#universityLocation").value.trim(),weekday:Number($("#universityWeekday").value),start_time:$("#universityStart").value,end_time:$("#universityEnd").value,start_date:effective,end_date:null,active:true};
    if(values.end_time<=values.start_time)return toast("Giờ kết thúc phải sau giờ bắt đầu");
    if(id){ const old=universitySchedules.find(x=>x.id===id); if(!old)return; if(old.start_date===effective) await store.upsertUniversitySchedule({...old,...values,id}); else { await store.endUniversitySchedule(id,effective); await store.upsertUniversitySchedule({...values,id:uid()}); } } else await store.upsertUniversitySchedule({...values,id:uid()});
    universitySchedules=await store.getUniversitySchedules(); $("#universityDialog").close(); renderAll(); markSaved(); toast("Đã lưu môn học cố định cho các tuần sau");
  };

  $("#addEventBtn").onclick=()=>openEventDialog(null,selectedWeekStart);
  function openEventDialog(ev=null,defaultDate=selectedWeekStart){
    $("#eventForm").reset();$("#eventId").value=ev?.id||"";$("#eventDialogTitle").textContent=ev?"Sửa lịch phát sinh":"Thêm lịch phát sinh / KT-TT";
    if(ev){$("#eventType").value=ev.event_type;$("#eventTitle").value=ev.title;$("#eventDetails").value=ev.details||"";$("#eventLocation").value=ev.location||"";$("#eventDate").value=ev.event_date;$("#eventStart").value=String(ev.start_time).slice(0,5);$("#eventEnd").value=String(ev.end_time).slice(0,5);$("#eventNote").value=ev.note||"";}
    else {$("#eventDate").value=defaultDate;$("#eventStart").value="07:00";$("#eventEnd").value="08:00";}
    $("#eventDialog").showModal();
  }
  $("#eventForm").onsubmit=async e=>{
    e.preventDefault(); const rec={id:$("#eventId").value||uid(),event_type:$("#eventType").value,event_date:$("#eventDate").value,title:$("#eventTitle").value.trim(),details:$("#eventDetails").value.trim(),location:$("#eventLocation").value.trim(),start_time:$("#eventStart").value,end_time:$("#eventEnd").value,note:$("#eventNote").value.trim()};
    if(rec.end_time<=rec.start_time)return toast("Giờ kết thúc phải sau giờ bắt đầu"); await saveWeeklyEvent(rec);$("#eventDialog").close();toast("Đã lưu lịch theo ngày");
  };

  $("#copyPrevWeekBtn").onclick=async()=>{
    const prevStart=addDays(selectedWeekStart,-7), prevEnd=addDays(prevStart,6); const source=weeklyEvents.filter(e=>e.event_date>=prevStart&&e.event_date<=prevEnd);
    if(!source.length)return toast("Tuần trước chưa có lịch học/kiến tập để sao chép");
    const currentEnd=addDays(selectedWeekStart,6); const current=weeklyEvents.filter(e=>e.event_date>=selectedWeekStart&&e.event_date<=currentEnd);
    let added=0;
    for(const e of source){ const targetDate=addDays(e.event_date,7); const dup=current.some(x=>x.event_date===targetDate&&x.event_type===e.event_type&&x.title===e.title&&String(x.start_time).slice(0,5)===String(e.start_time).slice(0,5)); if(dup)continue; await store.upsertWeeklyEvent({id:uid(),event_type:e.event_type,event_date:targetDate,title:e.title,details:e.details||"",location:e.location||"",start_time:String(e.start_time).slice(0,5),end_time:String(e.end_time).slice(0,5),note:e.note||""});added++; }
    weeklyEvents=await store.getWeeklyEvents();renderAll();markSaved();toast(`Đã sao chép ${added} lịch từ tuần trước`);
  };

  $("#todaySessions").onclick=async e=>{
    const st=e.target.dataset.status,key=e.target.dataset.key;
    if(st&&key){const x=getTeachingOccurrence(key);if(!x)return;x.status=st;await saveTeachingSession(x);toast(STATUS[st]);return;}
    if(e.target.dataset.reschedule){const x=getTeachingOccurrence(e.target.dataset.reschedule);if(!x)return;$("#rescheduleKey").value=x.key;$("#rescheduleDate").value=x.session_date;$("#rescheduleStart").value=String(x.start_time).slice(0,5);$("#rescheduleEnd").value=String(x.end_time).slice(0,5);$("#rescheduleNote").value=x.note||"";$("#rescheduleDialog").showModal();return;}
    if(e.target.dataset.note){const x=getTeachingOccurrence(e.target.dataset.note);if(!x)return;$("#noteKey").value=x.key;$("#sessionNote").value=x.note||"";$("#noteDialog").showModal();return;}
    if(e.target.dataset.editEvent){const ev=weeklyEvents.find(x=>x.id===e.target.dataset.editEvent);if(ev)openEventDialog(ev);return;}
    if(e.target.dataset.skipUniversity){const sid=e.target.dataset.skipUniversity,date=e.target.dataset.eventDate||selectedDate;const s=universitySchedules.find(x=>x.id===sid);if(s&&confirm(`Bỏ ${s.student_name} khỏi tuần có ngày ${shortDate(date)}? Các tuần sau vẫn giữ lịch.`)){await store.upsertScheduleException({schedule_id:sid,event_date:date,action:"cancelled",note:"Bỏ lịch tuần này"});scheduleExceptions=await store.getScheduleExceptions();renderAll();markSaved();toast("Đã bỏ lịch riêng tuần này");}}
  };
  $("#weeklyGrid").onclick=async e=>{
    if(e.target.dataset.skipUniversity){const sid=e.target.dataset.skipUniversity,date=e.target.dataset.eventDate;const s=universitySchedules.find(x=>x.id===sid);if(s&&confirm(`Bỏ ${s.student_name} riêng tuần này? Các tuần sau vẫn giữ lịch.`)){await store.upsertScheduleException({schedule_id:sid,event_date:date,action:"cancelled",note:"Bỏ lịch tuần này"});scheduleExceptions=await store.getScheduleExceptions();renderAll();markSaved();toast("Đã bỏ lịch riêng tuần này");}return;}
    if(e.target.dataset.editUniversity){const s=universitySchedules.find(x=>x.id===e.target.dataset.editUniversity);if(s)openUniversityDialog(s,e.target.dataset.effectiveDate||selectedWeekStart);return;}
    if(e.target.dataset.endUniversity){const s=universitySchedules.find(x=>x.id===e.target.dataset.endUniversity),effective=e.target.dataset.effectiveDate||selectedWeekStart;if(s&&confirm(`Dừng môn ${s.student_name} từ ${shortDate(effective)}? Các tuần trước vẫn được giữ.`)){await store.endUniversitySchedule(s.id,effective);universitySchedules=await store.getUniversitySchedules();renderAll();markSaved();toast("Đã dừng môn học từ ngày đã chọn");}return;}
    if(e.target.dataset.editEvent){const ev=weeklyEvents.find(x=>x.id===e.target.dataset.editEvent);if(ev)openEventDialog(ev);return;}
    if(e.target.dataset.deleteEvent){const ev=weeklyEvents.find(x=>x.id===e.target.dataset.deleteEvent);if(ev&&confirm(`Xóa "${ev.title}" khỏi tuần này?`)){await store.deleteWeeklyEvent(ev.id);weeklyEvents=await store.getWeeklyEvents();renderAll();markSaved();toast("Đã xóa lịch");}return;}
    if(e.target.dataset.editTeaching){const s=teachingSchedules.find(x=>x.id===e.target.dataset.editTeaching);if(s)openTeachingDialog(s,e.target.dataset.effectiveDate||currentDate());return;}
    if(e.target.dataset.endTeaching){const s=teachingSchedules.find(x=>x.id===e.target.dataset.endTeaching);const effective=e.target.dataset.effectiveDate||currentDate();if(s&&confirm(`Dừng lịch ${s.student_name} · ${s.subject} từ ${shortDate(effective)}? Lịch các tuần trước vẫn được giữ.`)){await store.endTeachingSchedule(s.id,effective);teachingSchedules=await store.getTeachingSchedules();renderAll();markSaved();toast("Đã kết thúc lịch từ ngày đã chọn");}}
  };
  $("#hiddenExceptions").onclick=async e=>{ if(e.target.dataset.restoreUniversity){await store.deleteScheduleException(e.target.dataset.restoreUniversity,e.target.dataset.eventDate);scheduleExceptions=await store.getScheduleExceptions();renderAll();markSaved();toast("Đã khôi phục lịch học tuần này");} };
  $("#rescheduleForm").onsubmit=async e=>{e.preventDefault();const x=getTeachingOccurrence($("#rescheduleKey").value);if(!x)return;x.session_date=$("#rescheduleDate").value;x.start_time=$("#rescheduleStart").value;x.end_time=$("#rescheduleEnd").value;x.note=$("#rescheduleNote").value.trim();await saveTeachingSession(x);$("#rescheduleDialog").close();toast("Đã đổi riêng buổi này");};
  $("#noteForm").onsubmit=async e=>{e.preventDefault();const x=getTeachingOccurrence($("#noteKey").value);if(!x)return;x.note=$("#sessionNote").value.trim();await saveTeachingSession(x);$("#noteDialog").close();toast("Đã lưu ghi chú");};
  $("#historyMonth").onchange=renderHistory;$("#historyStatus").onchange=renderHistory;

  $("#exportBtn").onclick=async()=>{const data=await store.exportData();const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`teaching-attendance-backup-${currentDate()}.json`;a.click();URL.revokeObjectURL(a.href);};
  $("#importInput").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());await store.importData(data);await loadAll(false);toast("Đã nhập dữ liệu");}catch(err){toast("File JSON không hợp lệ: "+err.message);}e.target.value="";};
  $("#seedBtn").onclick=async()=>{await seedTeaching(false);await seedUniversity(false);teachingSchedules=await store.getTeachingSchedules();universitySchedules=await store.getUniversitySchedules();renderAll();markSaved();};
  $$('[data-close-dialog]').forEach(b=>b.onclick=()=>$("#"+b.dataset.closeDialog).close());

  async function start(){
    $("#historyMonth").value=currentDate().slice(0,7); renderClock();setInterval(renderClock,1000);
    setInterval(()=>{if(selectedDate===currentDate())renderToday();if(selectedWeekStart===mondayOf(new Date()))renderWeek();},30000);
    try{await initBackend();await loadAll(true);}catch(err){console.error(err);$("#cloudBadge").textContent="Lỗi dữ liệu";toast(err.message);}
    if("serviceWorker" in navigator)navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
  start();
})();
