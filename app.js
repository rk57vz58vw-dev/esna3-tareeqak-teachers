(() => {
  "use strict";
  const cfg = window.ESNA3_CONFIG || {};
  const $ = s => document.querySelector(s);
  const loginView=$("#loginView"), dashboard=$("#dashboardView"), loginForm=$("#loginForm");
  let session = null, courses = [];
  const storageKey="esna3_teacher_session_v1";
  const say=(msg)=>{const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)};
  const configOK=()=>cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  const headers=(extra={})=>({"apikey":cfg.SUPABASE_ANON_KEY,"Authorization":"Bearer "+(session?.access_token||cfg.SUPABASE_ANON_KEY),"Content-Type":"application/json",...extra});
  async function api(path,options={}) {
    if(!configOK()) throw new Error("أضف بيانات Supabase في ملف config.js أولاً.");
    let res=await fetch(cfg.SUPABASE_URL+"/rest/v1/"+path,{...options,headers:headers(options.headers||{})});
    if(res.status===401 && session?.refresh_token){
      const rr=await fetch(cfg.SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":cfg.SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
      if(rr.ok){session=await rr.json();localStorage.setItem(storageKey,JSON.stringify(session));res=await fetch(cfg.SUPABASE_URL+"/rest/v1/"+path,{...options,headers:headers(options.headers||{})});}
    }
    const data=await res.json().catch(()=>null);
    if(!res.ok) throw new Error(data?.message||data?.msg||"تعذر تنفيذ الطلب. راجع إعدادات قاعدة البيانات والصلاحيات.");
    return data;
  }
  function showDashboard(){loginView.classList.add("hidden");dashboard.classList.remove("hidden");$("#logoutBtn").classList.remove("hidden");$("#teacherLabel").textContent=session?.user?.email||"حساب المعلم";}
  function showLogin(){dashboard.classList.add("hidden");loginView.classList.remove("hidden");$("#logoutBtn").classList.add("hidden");}
  loginForm.addEventListener("submit",async e=>{
    e.preventDefault();$("#loginError").textContent="";
    if(!configOK()){ $("#loginError").textContent="يجب إعداد رابط Supabase ومفتاح Anon في config.js قبل تسجيل الدخول.";return; }
    const fd=new FormData(loginForm);
    try{
      const res=await fetch(cfg.SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":cfg.SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:fd.get("email"),password:fd.get("password")})});
      const data=await res.json();if(!res.ok)throw new Error(data.msg||data.message||"بيانات الدخول غير صحيحة.");
      session=data;localStorage.setItem(storageKey,JSON.stringify(session));showDashboard();await loadCourses();
    }catch(err){$("#loginError").textContent=err.message;}
  });
  $("#logoutBtn").addEventListener("click",async()=>{try{await fetch(cfg.SUPABASE_URL+"/auth/v1/logout",{method:"POST",headers:headers()});}catch{}localStorage.removeItem(storageKey);session=null;courses=[];showLogin();});
  function formData(){const f=$("#courseForm"),fd=new FormData(f);return {title:String(fd.get("title")).trim(),subject:String(fd.get("subject")).trim(),stage:String(fd.get("stage")),teacher_name:String(fd.get("teacher_name")).trim(),lessons:Number(fd.get("lessons"))||1,description:String(fd.get("description")).trim(),lesson_url:String(fd.get("lesson_url")).trim()||null,image_url:String(fd.get("image_url")).trim()||null,status:String(fd.get("status"))||"published"};}
  function resetForm(){const f=$("#courseForm");f.reset();f.elements.id.value="";$("#formTitle").textContent="إضافة كورس جديد";$("#saveBtn").textContent="حفظ الكورس";$("#cancelEditBtn").classList.add("hidden");}
  $("#cancelEditBtn").addEventListener("click",resetForm);
  $("#courseForm").addEventListener("submit",async e=>{
    e.preventDefault();const f=e.currentTarget;const id=f.elements.id.value;const item=formData();
    if(item.lesson_url&&!/^https?:\/\//i.test(item.lesson_url)){say("اكتب رابطًا يبدأ بـ https:// أو http://");return;}
    try{
      if(id) await api("courses?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify(item)});
      else await api("courses",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify(item)});
      resetForm();$("#formMessage").textContent="تم حفظ الكورس في قاعدة البيانات المشتركة.";say("تم حفظ الكورس بنجاح");await loadCourses();
    }catch(err){say(err.message);$("#formMessage").textContent=err.message;}
  });
  function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function render(){
    $("#totalCount").textContent=courses.length;$("#publishedCount").textContent=courses.filter(c=>c.status==="published").length;$("#draftCount").textContent=courses.filter(c=>c.status==="draft").length;
    $("#courseList").innerHTML=courses.length?courses.map(c=>`<div class="course-row"><div class="meta"><b>${safe(c.title)}</b><small>${safe(c.subject)} · ${safe(c.stage)} · ${safe(c.teacher_name)} · ${Number(c.lessons)||1} درس</small></div><span class="status ${c.status==="draft"?"draft":""}">${c.status==="draft"?"مسودة":"منشور"}</span><div class="row-actions"><button class="edit" data-edit="${safe(c.id)}">تعديل</button><button class="delete" data-delete="${safe(c.id)}">حذف</button></div></div>`).join(""):'<p class="empty">لا توجد كورسات حتى الآن. أضف أول كورس من النموذج.</p>';
  }
  async function loadCourses(){try{courses=await api("courses?select=*&order=created_at.desc");render();}catch(err){say(err.message);$("#courseList").innerHTML=`<p class="empty">${safe(err.message)}</p>`;}}
  $("#courseList").addEventListener("click",async e=>{
    const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");
    if(edit){const c=courses.find(x=>x.id===edit.dataset.edit);if(!c)return;const f=$("#courseForm");Object.entries(c).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??"";});f.elements.id.value=c.id;$("#formTitle").textContent="تعديل الكورس";$("#saveBtn").textContent="حفظ التعديلات";$("#cancelEditBtn").classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});}
    if(del){if(!confirm("هل تريد حذف هذا الكورس؟"))return;try{await api("courses?id=eq."+encodeURIComponent(del.dataset.delete),{method:"DELETE"});say("تم حذف الكورس");await loadCourses();}catch(err){say(err.message);}}
  });
  $("#refreshBtn").addEventListener("click",loadCourses);
  try{session=JSON.parse(localStorage.getItem(storageKey)||"null");}catch{session=null;}
  if(session?.access_token){showDashboard();loadCourses();}else showLogin();
})();
