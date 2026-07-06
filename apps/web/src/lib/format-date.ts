export function formatIsoDate(value: string): string {
  const isoDate = value.slice(0, 10);
  const [year, month, day] = isoDate.split('-');

  return year && month && day ? `${day}.${month}.${year}` : isoDate;
}
