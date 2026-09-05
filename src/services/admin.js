import { supabase } from "./supabase";

export const ADMIN_EMAILS = ["ahmedalbarca20@gmail.com"];

export function isUserAdmin(user) {
  if (!user) return false;
  const email = (user.email || "").toLowerCase().trim();
  const metaRole = (user.user_metadata?.role || user.raw_user_meta_data?.role || "").toLowerCase();
  return ADMIN_EMAILS.includes(email) || metaRole === "admin" || metaRole === "superadmin";
}

/**
 * Get all registered offices (Strictly metadata only - No customer or financial debt access)
 */
export async function getAllOffices() {
  const { data: offices, error } = await supabase
    .from("offices")
    .select("id, name, username, email, active, contract_start, contract_end, created_at, type")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching offices:", error);
    throw error;
  }

  return offices || [];
}

/**
 * Update office details, subscription dates, or active status
 */
export async function updateOffice(officeId, updates) {
  const { data, error } = await supabase
    .from("offices")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", officeId)
    .select()
    .single();

  if (error) {
    console.error("Error updating office:", error);
    throw error;
  }

  return data;
}

/**
 * Create a login account then register the office row linked to that user.
 */
export async function createOffice(officeData) {
  const {
    data: { session: adminSession },
  } = await supabase.auth.getSession();

  if (!adminSession) {
    throw new Error("جلسة المشرف غير موجودة. أعد تسجيل الدخول ثم حاول مجدداً");
  }

  const response = await fetch("/api/create-office", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminSession.access_token}`,
    },
    body: JSON.stringify(officeData),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "تعذر إنشاء المكتب");
    error.status = response.status;
    console.error("Error creating office:", error);
    throw error;
  }

  return result.office;
}

/**
 * Delete an office
 */
export async function deleteOffice(officeId) {
  const { error } = await supabase.from("offices").delete().eq("id", officeId);
  if (error) {
    console.error("Error deleting office:", error);
    throw error;
  }
  return true;
}

/**
 * Get offices subscription metrics only (No access to private debts or clients)
 */
export async function getPlatformStats() {
  const offices = await getAllOffices();

  const totalOffices = offices.length;
  const activeOffices = offices.filter((o) => o.active).length;
  const inactiveOffices = totalOffices - activeOffices;

  const today = new Date();
  const expiredContracts = offices.filter((o) => {
    if (!o.contract_end) return false;
    return new Date(o.contract_end) < today;
  }).length;

  const expiringSoonContracts = offices.filter((o) => {
    if (!o.contract_end) return false;
    const diff = Math.ceil((new Date(o.contract_end) - today) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 15;
  }).length;

  return {
    totalOffices,
    activeOffices,
    inactiveOffices,
    expiredContracts,
    expiringSoonContracts,
  };
}
