export const EDUCATION_COLORS: Record<number, string> = {
  1: '#a75d3b',
  2: '#c9853f',
  3: '#c6a23f',
  4: '#4b946b',
  5: '#378d91',
  6: '#4e72b5',
  7: '#7657a5',
  99: '#7b8580',
}

export function getEducationColor(order: number): string {
  return EDUCATION_COLORS[order] ?? EDUCATION_COLORS[99]
}
