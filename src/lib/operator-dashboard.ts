import {
  deliveryUrgencyLabels,
  droneClassLabels,
  orderStatusLabels,
} from "@/constants/domain";
import {
  getMockNotificări,
  getMockOperatorProfile,
  getMockOrderPoints,
  getMockOrders,
} from "@/lib/mock-data";
import { sortOrdersByDate } from "@/lib/orders";
import type { DeliveryOrder, OrderPoint } from "@/types/entities";
import type {
  OperatorDashboardData,
  OperatorTask,
  OperatorTaskType,
} from "@/types/operator-dashboard";

function compactAddress(point?: OrderPoint | null) {
  return point?.address.formattedAddress.split(",")[0]?.trim() ?? "Punct Pitești";
}

function getRequiredAction(type: OperatorTaskType, order: DeliveryOrder) {
  switch (type) {
    case "current":
      return order.status === "in_flight"
        ? "Start drop-off validation and prepare recipient handoff checks."
        : "Confirm package loading before dispatch moves forward.";
    case "upcoming":
      return "Verificare pickup readiness and keep the dispatch window prepared.";
    case "pickup_validation":
      return "Start pickup validation and verify the package can be loaded safely.";
    case "dropoff_validation":
      return "Start drop-off validation and confirm the recipient handoff point.";
    case "incident":
      return "Report issue details and keep the order visible for operator follow-up.";
  }
}

function createTask({
  order,
  pickup,
  dropoff,
  type,
}: {
  order: DeliveryOrder;
  pickup?: OrderPoint | null;
  dropoff?: OrderPoint | null;
  type: OperatorTaskType;
}): OperatorTask {
  return {
    id: `${type}_${order.id}`,
    orderId: order.id,
    type,
    status: order.status,
    statusLabel: orderStatusLabels[order.status],
    pickupSummary: compactAddress(pickup),
    dropoffSummary: compactAddress(dropoff),
    assignedDroneClass: order.assignedDroneClassId ?? null,
    assignedDroneClassLabel: order.assignedDroneClassId
      ? droneClassLabels[order.assignedDroneClassId]
      : "Clasă drone pending",
    priority: order.urgency,
    priorityLabel: deliveryUrgencyLabels[order.urgency],
    requiredAction: getRequiredAction(type, order),
    scheduledFor: order.scheduledFor ?? null,
    issueSummary: order.cancellationReason ?? null,
  };
}

export function getOperatorDashboardData(): OperatorDashboardData {
  const operator = getMockOperatorProfile();
  const orders = getMockOrders();
  const points = getMockOrderPoints();
  const notifications = getMockNotificări().filter(
    (notification) => notification.userProfileId === operator.id,
  );

  const pointById = new Map(points.map((point) => [point.id, point]));
  const activeOrders = sortOrdersByDate(
    orders.filter((order) =>
      ["queued", "scheduled", "in_flight"].includes(order.status),
    ),
    "scheduledFor",
    "asc",
  );
  const currentOrder =
    activeOrders.find((order) => order.status === "in_flight") ??
    activeOrders.find((order) => order.status === "queued") ??
    activeOrders[0] ??
    null;

  const currentTask = currentOrder
    ? createTask({
        order: currentOrder,
        pickup: pointById.get(currentOrder.pickupPointId),
        dropoff: pointById.get(currentOrder.dropoffPointId),
        type: "current",
      })
    : null;

  const upcomingTasks = activeOrders
    .filter((order) => order.id !== currentOrder?.id)
    .map((order) =>
      createTask({
        order,
        pickup: pointById.get(order.pickupPointId),
        dropoff: pointById.get(order.dropoffPointId),
        type: "upcoming",
      }),
    );

  const pickupValidations = activeOrders
    .filter((order) => {
      const pickup = pointById.get(order.pickupPointId);

      return pickup?.status === "pending" || pickup?.status === "confirmed";
    })
    .map((order) =>
      createTask({
        order,
        pickup: pointById.get(order.pickupPointId),
        dropoff: pointById.get(order.dropoffPointId),
        type: "pickup_validation",
      }),
    );

  const dropoffValidations = activeOrders
    .filter((order) => {
      const dropoff = pointById.get(order.dropoffPointId);

      return dropoff?.status === "pending" || dropoff?.status === "confirmed";
    })
    .map((order) =>
      createTask({
        order,
        pickup: pointById.get(order.pickupPointId),
        dropoff: pointById.get(order.dropoffPointId),
        type: "dropoff_validation",
      }),
    );

  const failedOrders = sortOrdersByDate(
    orders.filter((order) => order.status === "failed"),
    "updatedAt",
    "desc",
  );
  const notificationIncidentTasks = notifications
    .filter((notification) =>
      ["critical", "warning"].includes(notification.type),
    )
    .flatMap((notification) => {
      const order = notification.orderId
        ? orders.find((item) => item.id === notification.orderId)
        : null;

      if (!order) {
        return [];
      }

      return [
        {
          ...createTask({
            order,
            pickup: pointById.get(order.pickupPointId),
            dropoff: pointById.get(order.dropoffPointId),
            type: "incident",
          }),
          issueSummary: notification.body,
        },
      ];
    });
  const orderIncidentTasks = failedOrders.map((order) =>
    createTask({
      order,
      pickup: pointById.get(order.pickupPointId),
      dropoff: pointById.get(order.dropoffPointId),
      type: "incident",
    }),
  );
  const incidentByOrderId = new Map<string, OperatorTask>();

  for (const task of [...notificationIncidentTasks, ...orderIncidentTasks]) {
    if (!incidentByOrderId.has(task.orderId)) {
      incidentByOrderId.set(task.orderId, task);
    }
  }

  return {
    currentTask,
    upcomingTasks,
    pickupValidations,
    dropoffValidations,
    incidents: [...incidentByOrderId.values()],
  };
}
