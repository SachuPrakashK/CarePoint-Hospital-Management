export const CHART_COLORS = [
  0x4679bd, 0x26a69a, 0x66a65c, 0x8e7cc3, 0xf4a261,
  0xe76f51, 0xe9c46a, 0x5468c4, 0xd66ba0, 0x38a3a5,
] as const;

export const APPOINTMENT_STATUS_COLORS: Record<string, number> = {
  SCHEDULED: 0x4679bd,
  CONFIRMED: 0x26a69a,
  CHECKED_IN: 0x8e7cc3,
  WAITING: 0xf4a261,
  IN_CONSULTATION: 0x38a3a5,
  COMPLETED: 0x66a65c,
  CANCELLED: 0xe76f51,
  NO_SHOW: 0xd66ba0,
};
