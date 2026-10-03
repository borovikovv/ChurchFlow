/** The current path with the kept filters plus one changed filter; empty values are left out. */
export function queryHref(
  pathname: string,
  preserveParams: Record<string, string | undefined>,
  name: string,
  value: string,
): string {
  const params = new URLSearchParams();
  Object.entries(preserveParams).forEach(([paramName, paramValue]) => {
    if (paramValue) {
      params.set(paramName, paramValue);
    }
  });

  if (value) {
    params.set(name, value);
  }

  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}
