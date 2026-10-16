import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export function formatStatus(value: string | null | undefined): string {
  return value?.trim().replace(/_+/g, ' ').replace(/\s+/g, ' ').toUpperCase() || 'UNKNOWN';
}

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge {
  readonly value = input<string | null | undefined>('');
  readonly label = computed(() => formatStatus(this.value()));
  readonly tone = computed(() => {
    const value = this.label();
    if (value === 'ADMITTED') return 'admitted';
    if (value === 'TRANSFERRED') return 'transferred';
    if (value === 'DISCHARGE PLANNED') return 'discharge-planned';
    if (value === 'DISCHARGED') return 'discharged';
    if (value === 'CANCELLED') return 'cancelled';
    if (['CONFIRMED', 'ACTIVE', 'PAID', 'APPROVED', 'AVAILABLE', 'HEALTHY', 'VALID', 'VERIFIED', 'DISPENSED', 'ADMINISTERED', 'ACKNOWLEDGED'].includes(value)) return 'success';
    if (['PENDING', 'PENDING REVIEW', 'IN PROGRESS', 'WAITING', 'PARTIAL', 'PARTIALLY PAID', 'REQUESTED', 'ORDERED', 'LOW STOCK', 'EXPIRING SOON', 'RESERVED', 'DISCHARGE PLANNED', 'HELD'].includes(value)) return 'warning';
    if (['REJECTED', 'UNPAID', 'INACTIVE', 'LOCKED', 'FAILED', 'EXPIRED', 'OUT OF STOCK', 'OUT OF SERVICE', 'NO SHOW', 'BLOCKED', 'MISSED', 'REFUSED'].includes(value)) return 'danger';
    if (['CHECKED IN', 'CALLED', 'PROCESSING', 'SAMPLE COLLECTED', 'RESULT ENTERED', 'PERFORMED', 'CLEANING', 'ASSIGNED', 'SUBMITTED', 'PLANNED'].includes(value)) return 'info';
    if (['SCHEDULED', 'IN CONSULTATION', 'REPORTING', 'UNDER REVIEW', 'ON TRIP'].includes(value)) return 'purple';
    if (['COMPLETED', 'SETTLED', 'REFUNDED'].includes(value)) return 'teal';
    return 'neutral';
  });
}
