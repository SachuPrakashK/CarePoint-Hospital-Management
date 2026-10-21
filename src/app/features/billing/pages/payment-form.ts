import { Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Phase23Store } from '../../../core/services/phase23.store';

@Component({
  selector: 'app-payment-form',
  imports: [ReactiveFormsModule],
  templateUrl: './payment-form.html',
})
export class PaymentForm {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Phase23Store);
  readonly invoiceId = input.required<string>();
  readonly initialAmount = input.required<number>();
  readonly saved = output<void>();
  readonly dirtyChanged = output<boolean>();
  submitting = false;
  error = '';
  private readonly idempotencyKey = crypto.randomUUID();
  readonly form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: ['Cash', Validators.required],
    reference: ['', Validators.maxLength(100)],
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
      await this.store.pay(
        this.invoiceId(),
        value.amount,
        value.method,
        value.reference.trim(),
        this.idempotencyKey,
      );
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.saved.emit();
    } catch (error: any) {
      this.error = error?.error?.message ?? error?.message ?? 'Payment could not be recorded.';
    } finally {
      this.submitting = false;
    }
  }
}
