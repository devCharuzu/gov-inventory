export const EMPLOYEE_UNITS = [
  "Administrative Unit",
  "Planning Unit",
  "Regulatory Unit",
  "Technical Assistance Unit",
  "Research Unit",
  "Directors Office",
  "Others",
] as const;

export type EmployeeUnit = (typeof EMPLOYEE_UNITS)[number];

export function isEmployeeUnit(value: string | null | undefined): value is EmployeeUnit {
  return EMPLOYEE_UNITS.some((unit) => unit === value);
}
