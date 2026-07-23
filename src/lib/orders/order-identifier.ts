const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function getOrderIdentifierColumn(
  orderId: string,
): "id" | "local_order_id" {
  return uuidPattern.test(orderId) ? "id" : "local_order_id";
}
