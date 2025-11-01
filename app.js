/*******************************
 *  تهيئة Supabase
 *******************************/
const SUPABASE_URL = "https://fjvbhlvwdbgyoooeqhhk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqdmJobHZ3ZGJneW9vb2VxaGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDExMzQsImV4cCI6MjA3NzMxNzEzNH0.vtoTj2to6RWGVXj3VbWTzxKkJcKRUKu9VgoeD792tQE";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/*******************************
 *  عناصر DOM وتحويل التبويبات
 *******************************/
const tabs       = document.querySelectorAll(".tab-btn");
const sections   = document.querySelectorAll(".tab");
const whoamiEl   = document.getElementById("whoami");
const logoutBtn  = document.getElementById("logoutBtn");

tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabs.forEach((b) => b.classList.remove("active"));
    sections.forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

/*******************************
 *  حالة المستخدم (طالبة محليًا)
 *******************************/
let studentSession = JSON.parse(localStorage.getItem("studentSession") || "null");

function renderWhoAmI(user) {
  if (studentSession) {
    whoamiEl.textContent = `طالبة: ${studentSession.name} — ${studentSession.class_name}`;
    return;
  }
  if (user?.email) {
    whoamiEl.textContent = `معلمة/منسقة: ${user.email}`;
    return;
  }
  whoamiEl.textContent = "غير مسجَّلة دخول";
}

async function refreshAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  renderWhoAmI(session?.user || null);
}
refreshAuth();

/*******************************
 *  تسجيل خروج موحّد
 *******************************/
logoutBtn?.addEventListener("click", async () => {
  studentSession = null;
  localStorage.removeItem("studentSession");
  await supabase.auth.signOut();
  renderWhoAmI(null);
  await loadMyInitiatives(); // يفرّغ الجدول
});

/***************************************
 *  دخول الطالبة عبر رمز لمرة واحدة
 *  RPC: claim_student_token(p_token text)
 ***************************************/
function cleanToken(t) {
  return String(t || "")
    .trim()
    .replace(/[^\w\-]/g, ""); // أرقام/حروف/شرطة فقط
}

async function studentLoginWithToken(token) {
  const cleaned = cleanToken(token);
  if (!cleaned) {
    alert("أدخلي رمز الدخول");
    return null;
  }

  const { data, error } = await supabase.rpc("claim_student_token", {
    p_token: cleaned,
  });

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    console.error("claim_student_token error:", error);
    alert("رمز الدخول غير صالح أو منتهي.");
    return null;
  }

  // قد تعود صفًا واحدًا أو مصفوفة صفوف
  const row = Array.isArray(data) ? data[0] : data;

  const sess = {
    id: row.student_id || row.id,
    name: row.student_name || row.name,
    class_name: row.class_name || row.classname || row.class,
  };

  // خزّن كجلسة محلية للطالبة
  studentSession = sess;
  localStorage.setItem("studentSession", JSON.stringify(sess));

  renderWhoAmI(null);           // سيعرض معلومات الطالبة
  await loadMyInitiatives();    // حمّل مبادراتها

  return sess;
}

// زر إدخال الرمز يدويًا
const claimBtn = document.getElementById("claimTokenBtn");
if (claimBtn) {
  claimBtn.addEventListener("click", async () => {
    const input = document.getElementById("studentToken");
    const token = input ? input.value : "";
    const sess = await studentLoginWithToken(token);
    if (sess) alert("تم الدخول بنجاح.");
  });
}

/*****************************************
 *  دخول المعلمة/المنسقة عبر OTP للبريد
 *****************************************/
document.getElementById("sendOtpBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("teacherEmail").value.trim();
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) {
    alert("تعذر الإرسال.");
    return;
  }
  alert("تم إرسال رابط الدخول إلى بريدك.");
});

/*****************************************
 *  واجهة الطالبة — إضافة مبادرة
 *****************************************/
const impactSlider = document.getElementById("impactFactor");
const impactVal    = document.getElementById("impactVal");

impactSlider?.addEventListener("input", () => {
  impactVal.textContent = impactSlider.value;
});

document.getElementById("submitInitiativeBtn")?.addEventListener("click", async () => {
  if (!studentSession) {
    alert("يرجى الدخول أولاً.");
    return;
  }

  const title          = document.getElementById("title").value.trim();
  const description    = document.getElementById("description").value.trim();
  const value_category = document.getElementById("valueCategory").value;
  const impact_factor  = Number(document.getElementById("impactFactor").value);
  const evidence_factor = document.getElementById("hasEvidence").checked ? 1.2 : 1.0;

  if (!title) {
    alert("أدخلي العنوان.");
    return;
  }

  const { error } = await supabase.from("initiatives").insert({
    student_id:   studentSession.id,
    student_name: studentSession.name,
    class_name:   studentSession.class_name,
    value_category,
    title,
    description,
    submitted_at: new Date().toISOString(),
    status: "pending",
    base_points: 10,
    value_weight: null,
    impact_factor,
    evidence_factor,
    penalty: 0,
    total_points: null,
  });

  if (error) {
    alert("تعذر الإرسال.");
    return;
  }

  document.getElementById("title").value = "";
  document.getElementById("description").value = "";
  await loadMyInitiatives();
  alert("تم إرسال المبادرة.");
});

/*****************************************
 *  عرض مبادرات الطالبة
 *****************************************/
async function loadMyInitiatives() {
  const tbody = document.querySelector("#myInitiatives tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!studentSession) return;

  const { data, error } = await supabase
    .from("initiatives")
    .select("*")
    .eq("student_id", studentSession.id)
    .order("submitted_at", { ascending: false });

  if (error) return;

  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    const dt = new Date(r.submitted_at);
    tr.innerHTML = `
      <td>${dt.toLocaleDateString("ar-SA")}</td>
      <td>${r.title || ""}</td>
      <td>${r.status || ""}</td>
      <td>${r.total_points?.toFixed?.(2) || "-"}</td>`;
    tbody.appendChild(tr);
  });
}
loadMyInitiatives();

/*****************************************
 *  مراجعة المبادرات (معلمة/منسقة)
 *****************************************/
async function loadPending() {
  const tbody = document.querySelector("#pendingTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data, error } = await supabase
    .from("initiatives")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at", { ascending: false });

  if (error) return;

  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.student_name}</td>
      <td>${r.class_name}</td>
      <td>${r.value_category}</td>
      <td>${r.title}</td>
      <td>${r.description || ""}</td>
      <td>${new Date(r.submitted_at).toLocaleString("ar-SA")}</td>
      <td class="actions">
        <button data-act="approve" data-id="${r.id}">اعتماد</button>
        <button class="secondary" data-act="return" data-id="${r.id}">إرجاع</button>
        <button class="secondary" data-act="reject" data-id="${r.id}">رفض</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function handleAction(id, act) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert("يلزم الدخول.");
    return;
  }

  const patch = {
    status: act === "approve" ? "approved" : act === "return" ? "returned" : "rejected",
    reviewed_at: new Date().toISOString(),
    reviewer: session.user.email,
  };

  if (act === "approve") {
    const { data, error } = await supabase
      .from("initiatives")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      alert("تعذر التحديث.");
      return;
    }

    // وزن القيم — يمكن تعديله لاحقًا
    const valueWeights = { "الانضباط": 1.0, "التعاون": 1.1, "الأمانة": 1.2, "العزيمة": 1.15 };
    const base = 10;
    const vw = valueWeights[data.value_category] ?? 1.0;
    const impact = Number(data.impact_factor || 1.0);
    const evidence = Number(data.evidence_factor || 1.0);
    const total = base * vw * impact * evidence - 0;

    patch.base_points  = base;
    patch.value_weight = vw;
    patch.penalty      = 0;
    patch.total_points = Number(total.toFixed(2));
  }

  const { error: upErr } = await supabase.from("initiatives").update(patch).eq("id", id);
  if (upErr) {
    alert("فشل التحديث.");
    return;
  }

  await loadPending();
  await loadHonorBoard();
  await loadMonthlyReport();
}

document.querySelector("#pendingTable")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  handleAction(btn.getAttribute("data-id"), btn.getAttribute("data-act"));
});

/*****************************************
 *  لوحة الشرف الأسبوعية
 *****************************************/
async function loadHonorBoard() {
  const list = document.getElementById("honorBoard");
  if (!list) return;
  list.innerHTML = "";

  const { data, error } = await supabase.from("initiatives_weekly").select("*");
  if (error) return;

  const top = (data || [])
    .sort((a, b) => b.total_points_sum - a.total_points_sum)
    .slice(0, 10);

  top.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = `${r.student_name} — ${r.class_name} — ${r.total_points_sum.toFixed(2)} نقطة`;
    list.appendChild(li);
  });
}

/*****************************************
 *  التقرير الشهري حسب القيم
 *****************************************/
async function loadMonthlyReport() {
  const tbody = document.querySelector("#monthlyReport tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const { data, error } = await supabase
    .from("initiatives_monthly_values")
    .select("*")
    .order("month", { ascending: false });

  if (error) return;

  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    const m = new Date(r.month);
    tr.innerHTML = `
      <td>${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}</td>
      <td>${r.value_category}</td>
      <td>${r.initiatives_count}</td>
      <td>${Number(r.total_points_sum || 0).toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
}

/*****************************************
 *  تصدير CSV بترميز UTF-8 BOM
 *****************************************/
function toCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return rows.map((r) => Object.values(r).map(esc).join(",")).join("\n");
}
function downloadCSV(filename, rows) {
  const bom  = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// مبادراتي (طالبات)
document.getElementById("exportMyCsv")?.addEventListener("click", async () => {
  if (!studentSession) return;
  const { data } = await supabase
    .from("initiatives")
    .select("*")
    .eq("student_id", studentSession.id)
    .order("submitted_at", { ascending: false });

  const rows = (data || []).map((r) => ({
    التاريخ: new Date(r.submitted_at).toLocaleString("ar-SA"),
    العنوان: r.title || "",
    الوصف: r.description || "",
    القيمة: r.value_category || "",
    الحالة: r.status || "",
    النقاط: r.total_points ?? "",
  }));

  downloadCSV("مبادراتي.csv", rows);
});

// تقرير المدرسة (معتمد فقط)
document.getElementById("exportSchoolCsv")?.addEventListener("click", async () => {
  const { data } = await supabase.from("initiatives").select("*").eq("status", "approved");
  const rows = (data || []).map((r) => ({
    الطالبة: r.student_name,
    الصف: r.class_name,
    القيمة: r.value_category,
    العنوان: r.title,
    الوصف: r.description || "",
    التاريخ: new Date(r.reviewed_at || r.submitted_at).toLocaleString("ar-SA"),
    النقاط: r.total_points ?? "",
  }));
  downloadCSV("تقرير_المدرسة.csv", rows);
});

/*****************************************
 *  مزامنة الواجهة مع حالة المصادقة
 *****************************************/
supabase.auth.onAuthStateChange((_evt, session) => {
  renderWhoAmI(session?.user || null);
  loadPending();
  loadHonorBoard();
  loadMonthlyReport();
});

/*****************************************
 *  التقاط الرمز من الرابط والدخول تلقائيًا
 *****************************************/
function getTokenFromURL() {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("token");
  } catch {
    return null;
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  const t = getTokenFromURL();
  if (t) {
    const sess = await studentLoginWithToken(t);
    if (sess) {
      // إزالة الرمز من شريط العنوان بعد نجاح الدخول
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, url.toString());
    }
  }
});
