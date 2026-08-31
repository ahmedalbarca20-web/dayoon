import { supabase } from "./supabase";

/**
 * Get current authenticated office strictly matching user_id
 */
export async function getCurrentOffice() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  // Lookup office strictly by the authenticated user's ID
  const { data: office, error: officeError } = await supabase
    .from("offices")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (officeError) {
    console.error("خطأ في جلب المكتب:", officeError);
  }

  return office || null;
}

export async function getCurrentOfficeId() {
  const office = await getCurrentOffice();
  if (!office?.id) {
    throw new Error("لم يتم العثور على مكتب للمستخدم الحالي");
  }
  return office.id;
}

/*
  جلب الأشخاص التابعين للمكتب الحالي فقط
*/
export async function getPeople() {
  const officeId = await getCurrentOfficeId();

  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("office_id", officeId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("خطأ في جلب الأشخاص:", error);
    throw error;
  }

  return data || [];
}

/*
  جلب شخص واحد تابع لنفس المكتب
*/
export async function getPersonById(personId) {
  const officeId = await getCurrentOfficeId();

  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("id", personId)
    .eq("office_id", officeId)
    .single();

  if (error) {
    console.error("خطأ في جلب الشخص:", error);
    throw error;
  }

  return data;
}

/*
  إضافة شخص جديد للمكتب الحالي
*/
export async function createPerson(person) {
  const officeId = await getCurrentOfficeId();

  const { data, error } = await supabase
    .from("people")
    .insert([
      {
        office_id: officeId,
        name: person.name,
        phone: person.phone || null,
        address: person.address || null,
        notes: person.notes || null,
        amount: 0,
        balance: 0,
        account_type: "debtor",
        person_type: "customer",
        debt_date: new Date().toISOString().split("T")[0],
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("خطأ في إضافة الشخص:", error);
    throw error;
  }

  return data;
}

/*
  تعديل شخص في المكتب الحالي
*/
export async function updatePerson(personId, person) {
  const officeId = await getCurrentOfficeId();

  const { data, error } = await supabase
    .from("people")
    .update({
      name: person.name,
      phone: person.phone || null,
      address: person.address || null,
      notes: person.notes || null,
    })
    .eq("id", personId)
    .eq("office_id", officeId)
    .select()
    .single();

  if (error) {
    console.error("خطأ في تعديل الشخص:", error);
    throw error;
  }

  return data;
}

/*
  حذف شخص من المكتب الحالي
*/
export async function deletePerson(personId) {
  const officeId = await getCurrentOfficeId();

  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", personId)
    .eq("office_id", officeId);

  if (error) {
    console.error("خطأ في حذف الشخص:", error);
    throw error;
  }

  return true;
}

export async function updateOfficeProfile(updates) {
  const office = await getCurrentOffice();
  if (!office?.id) {
    throw new Error("لم يتم العثور على مكتب للمستخدم الحالي");
  }

  const { data, error } = await supabase
    .from("offices")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", office.id)
    .select()
    .single();

  if (error) {
    console.error("خطأ في تحديث المكتب:", error);
    throw error;
  }

  return data;
}
