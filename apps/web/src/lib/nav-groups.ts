export type AppNavGroup = 'primary' | 'more' | 'account';

export function navItemsInGroup<TItem extends { group: AppNavGroup }>(
  items: TItem[],
  group: AppNavGroup,
): TItem[] {
  return items.filter((item) => item.group === group);
}
