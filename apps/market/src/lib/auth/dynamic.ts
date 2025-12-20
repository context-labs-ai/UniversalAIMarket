export const DYNAMIC_ENVIRONMENT_ID =
  (process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || "").trim();
export const hasDynamicEnvironmentId = DYNAMIC_ENVIRONMENT_ID.length > 0;

// 用户角色类型
export type UserRole = "buyer" | "seller";

// 角色存储键名（localStorage）
export const ROLE_STORAGE_KEY = "universal-ai-market-role";

// 获取当前角色
export function getCurrentRole(): UserRole {
  if (typeof window === "undefined") return "buyer";
  const stored = localStorage.getItem(ROLE_STORAGE_KEY);
  if (stored === "seller") return "seller";
  return "buyer";
}

// 设置角色
export function setCurrentRole(role: UserRole): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLE_STORAGE_KEY, role);
}

// 切换角色
export function toggleRole(): UserRole {
  const current = getCurrentRole();
  const next = current === "buyer" ? "seller" : "buyer";
  setCurrentRole(next);
  return next;
}
