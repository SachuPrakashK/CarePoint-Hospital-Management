import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdministrationApiService,
  PermissionRecord,
  RoleRecord,
} from './administration-api.service';
import { ToastService } from '../../core/services/toast.service';
import { formatPermissionLabel } from '../../shared/utils/permission-label';
@Component({
  selector: 'app-role-form',
  imports: [ReactiveFormsModule],
  templateUrl: './role-form.html',
  styleUrl: './role-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleForm {
  private fb = inject(FormBuilder);
  private api = inject(AdministrationApiService);
  private toast = inject(ToastService);
  readonly role = input<RoleRecord | null>(null);
  readonly permissions = input<PermissionRecord[]>([]);
  readonly saved = output<void>();
  readonly cancelled = output<void>();
  readonly dirtyChanged = output<boolean>();
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly selected = signal(new Set<string>());
  readonly formatPermissionLabel = formatPermissionLabel;
  readonly groups = computed(() => {
    const map = new Map<string, PermissionRecord[]>();
    for (const p of this.permissions()) {
      const values = map.get(p.module) ?? [];
      values.push(p);
      map.set(p.module, values);
    }
    return [...map.entries()];
  });
  readonly form = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.minLength(2),
        Validators.maxLength(80),
      ],
    ],
    description: ['', [Validators.maxLength(500)]],
    status: ['ACTIVE' as 'ACTIVE' | 'INACTIVE', Validators.required],
  });
  private populate = effect(() => {
    const r = this.role();
    this.form.reset({
      name: r?.name ?? '',
      description: r?.description ?? '',
      status: r?.status ?? 'ACTIVE',
    });
    this.selected.set(new Set(r?.permissions.map((x) => x.permission.code) ?? []));
    this.form.markAsPristine();
  });
  constructor() {
    this.form.valueChanges.subscribe(() => this.dirtyChanged.emit(this.form.dirty));
  }
  checked(code: string) {
    return this.selected().has(code);
  }
  toggle(code: string, checked: boolean) {
    const next = new Set(this.selected());
    if (checked) next.add(code);
    else next.delete(code);
    this.selected.set(next);
    this.form.markAsDirty();
    this.dirtyChanged.emit(true);
  }
  groupChecked(values: PermissionRecord[]) {
    return values.every((p) => this.checked(p.code));
  }
  groupIndeterminate(values: PermissionRecord[]) {
    const selected = values.filter((p) => this.checked(p.code)).length;
    return selected > 0 && selected < values.length;
  }
  toggleGroup(values: PermissionRecord[], checked: boolean) {
    const next = new Set(this.selected());
    for (const permission of values)
      checked ? next.add(permission.code) : next.delete(permission.code);
    this.selected.set(next);
    this.form.markAsDirty();
    this.dirtyChanged.emit(true);
  }
  async save() {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const value = { ...this.form.getRawValue(), permissionCodes: [...this.selected()] };
      const role = this.role();
      await firstValueFrom(role ? this.api.updateRole(role.id, value) : this.api.createRole(value));
      this.form.markAsPristine();
      this.dirtyChanged.emit(false);
      this.toast.success(`Role ${role ? 'updated' : 'created'}.`);
      this.saved.emit();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Role could not be saved.');
    } finally {
      this.submitting.set(false);
    }
  }
}
