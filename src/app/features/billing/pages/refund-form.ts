import { Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Phase23Store } from '../../../core/services/phase23.store';

@Component({
  selector: 'app-refund-form',
  imports: [ReactiveFormsModule],
  templateUrl: './refund-form.html',
  styleUrl: './financial-form.scss',
})
export class RefundForm {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Phase23Store);
  readonly payment = input.required<any>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();
  readonly dirtyChanged = output<boolean>();
  submitting = false;
  error = '';
  private readonly idempotencyKey = crypto.randomUUID();
  readonly form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
  });
  constructor() {
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  ngOnInit() {
    this.form.controls.amount.addValidators(Validators.max(this.remaining()));
    this.form.controls.amount.setValue(this.remaining());
    this.form.markAsPristine();
  }
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;
    this.error = '';
    try {
      const value = this.form.getRawValue();
      await this.store.requestRefund(
        this.payment().id,
        value.amount,
        value.reason.trim(),
        this.idempotencyKey,
      );
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.saved.emit();
    } catch (error: any) {
      this.error = error?.error?.message ?? error?.message ?? 'Refund could not be requested.';
    } finally {
      this.submitting = false;
    }
  }
  refunded() {
    return (this.payment().refunds ?? [])
      .filter((refund: any) => refund.status !== 'Rejected')
      .reduce((sum: number, refund: any) => sum + Number(refund.amount), 0);
  }
  remaining() {
    return Math.max(0, Number(this.payment().amount) - this.refunded());
  }
  patientName() {
    const patient = this.payment().invoice?.patient;
    return `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim();
  }
  money(value: unknown) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(Number(value ?? 0));
  }
}
