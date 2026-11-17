/**
 * One value of a query parameter. The router types each as
 * `string | string[] | undefined`, because a URL may repeat a key; every
 * reader here wants a single value, so a repeated key yields its first.
 */
export const oneParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;
