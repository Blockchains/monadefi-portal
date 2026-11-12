export const BASE_VISITS = 0;

let total = BASE_VISITS;

export function readVisits(): number {
  return total;
}

export function countVisit(): number {
  total += 1;
  return total;
}
