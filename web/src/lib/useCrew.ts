"use client";

import { api } from "./api";
import type { CrewMember, Role } from "./api-types";
import { useApi } from "./useApi";

// The crew from Sui through Tatum (/api/crew). Only members who are employed right now are returned by role,
// so a vacant desk stays empty. The server does not report task or status, so the UI shows what it has.
export function useCrew() {
  const crew = useApi(() => api.crew(), []);
  const byRole = new Map<Role, CrewMember>();
  for (const member of crew.data?.agents ?? []) {
    if (member.role && member.employed) byRole.set(member.role, member);
  }
  return { byRole, loading: crew.loading, error: crew.error, data: crew.data };
}
