export function resolveAllowedColumn<const TColumn extends string>(
  value: unknown,
  allowedColumns: readonly TColumn[],
  fallback: TColumn,
): TColumn {
  return typeof value === "string" &&
    allowedColumns.includes(value as TColumn)
    ? (value as TColumn)
    : fallback;
}
