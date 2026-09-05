import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = ["ahmedalbarca20@gmail.com"];

function isAdmin(user) {
  const email = (user?.email || "").toLowerCase().trim();
  const role = (user?.user_metadata?.role || user?.app_metadata?.role || "").toLowerCase();
  return ADMIN_EMAILS.includes(email) || role === "admin" || role === "superadmin";
}

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!supabaseUrl || !serviceRoleKey) {
    return sendJson(response, 500, {
      error: "إعداد SUPABASE_SERVICE_ROLE_KEY غير موجود في Vercel",
    });
  }

  if (!accessToken) {
    return sendJson(response, 401, { error: "جلسة المشرف غير موجودة" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
    if (userError || !isAdmin(userData?.user)) {
      return sendJson(response, 403, { error: "غير مصرح بإنشاء مكتب" });
    }

    const officeData = request.body || {};
    const email = (officeData.email || "").trim().toLowerCase();
    const password = officeData.password || "";
    const name = (officeData.name || "").trim();

    if (!name) return sendJson(response, 400, { error: "اسم المكتب مطلوب" });
    if (!email) return sendJson(response, 400, { error: "البريد الإلكتروني مطلوب لإنشاء حساب الدخول" });
    if (password.length < 6) return sendJson(response, 400, { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "office" },
    });

    if (createUserError) {
      const message = createUserError.message?.toLowerCase() || "";
      if (message.includes("already") || message.includes("registered")) {
        return sendJson(response, 409, { error: "هذا البريد الإلكتروني مسجل مسبقاً" });
      }
      throw createUserError;
    }

    const payload = {
      name,
      username: (officeData.username || name).trim(),
      email,
      user_id: createdUser.user.id,
      active: officeData.active !== undefined ? officeData.active : true,
      contract_start: officeData.contract_start || new Date().toISOString().split("T")[0],
      contract_end: officeData.contract_end || null,
      role: "office",
      type: officeData.type || "standard",
    };

    let { data: office, error: officeError } = await adminClient
      .from("offices")
      .insert([payload])
      .select()
      .single();

    if (officeError) {
      const retryPayload = { ...payload };
      delete retryPayload.user_id;
      delete retryPayload.role;
      delete retryPayload.type;
      const retry = await adminClient.from("offices").insert([retryPayload]).select().single();
      office = retry.data;
      officeError = retry.error;
    }

    if (officeError) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id);
      throw officeError;
    }

    return sendJson(response, 200, { office });
  } catch (error) {
    console.error("Create office API error:", error);
    return sendJson(response, 500, {
      error: error?.message || "تعذر إنشاء المكتب",
    });
  }
}
