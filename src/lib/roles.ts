import { Role } from "@prisma/client";

export const ROLE_RANK: Record<Role, number> = {
  owner: 0,
  administrator: 1,
  revisioner: 2,
  teacher: 3,
  student: 4,
};

const SWITCH_MAP: Record<Role, Role[]> = {
  owner: [Role.administrator, Role.revisioner, Role.teacher, Role.student],
  administrator: [Role.revisioner, Role.teacher, Role.student],
  revisioner: [Role.teacher, Role.student],
  teacher: [Role.student],
  student: [],
};

const CREATE_MAP: Record<Role, Role[]> = {
  owner: [Role.administrator, Role.revisioner, Role.teacher, Role.student],
  administrator: [Role.revisioner, Role.teacher, Role.student],
  revisioner: [],
  teacher: [],
  student: [],
};

export function canSwitchTo(baseRole: Role, targetRole: Role): boolean {
  if (baseRole === targetRole) return true; // switching back to own role
  return SWITCH_MAP[baseRole]?.includes(targetRole) ?? false;
}

export function canCreateUser(creatorRole: Role, targetRole: Role): boolean {
  return CREATE_MAP[creatorRole]?.includes(targetRole) ?? false;
}

export function canEdit(role: Role): boolean {
  // Only revisioner and above can create edit candidates
  return ROLE_RANK[role] <= ROLE_RANK[Role.revisioner];
}

export function canReview(role: Role): boolean {
  // Only administrator and owner can accept/reject/publish
  return ROLE_RANK[role] <= ROLE_RANK[Role.administrator];
}
