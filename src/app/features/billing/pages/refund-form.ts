import { Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Phase23Store } from '../../../core/services/phase23.store';

@Component({
  selector: 'app-refund-form',
  imports: [ReactiveFormsModule],
  templateUrl: './refund-form.html',
})
export class RefundForm {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Phase23Store);
  readonly paymentId = input.required<string>();
  readonly initialAmount = input.required<number>();
  readonly saved = output<void>();
  readonly dirtyChanged = output<boolean>();
  submitting = false;
  error = '';
  readonly form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
  });
  constructor() {
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  ngOnInit() {
    this.form.controls.amount.setValue(this.initialAmount());
    this.form.markAsPristine();
  }
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;
    this.error = '';
    try {
      const value = this.form.getRawValue();
      await this.store.requestRefund(this.paymentId(), value.amount, value.reason.trim());
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.saved.emit();
    } catch (error: any) {
      this.error = error?.error?.message ?? error?.message ?? 'Refund could not be requested.';
    } finally {
      this.submitting = false;
    }
  }
}
