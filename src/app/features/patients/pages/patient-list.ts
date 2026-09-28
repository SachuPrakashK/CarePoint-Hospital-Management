import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PatientStore } from '../patient.store';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { ToastService } from '../../../core/services/toast.service';
import { Patient } from '../../../shared/models/clinical.models';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { SearchField } from '../../../shared/components/search/search-field';
@Component({
  imports: [ReactiveFormsModule, AppIcon, EmptyState, SearchField],
  templateUrl: './patient-list.html',
  styleUrl: './patient-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientList implements OnInit {
  readonly store = inject(PatientStore);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);
  readonly search = signal('');
  readonly status = signal('');
  readonly drawerOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly menuId = signal<string | null>(null);
  private readonly serverQuery = effect((onCleanup) => { const search=this.search(),status=this.status(); const timer=setTimeout(()=>{this.store.search.set(search);this.store.status.set(status);this.store.page.set(1);void this.store.load();},300);onCleanup(()=>clearTimeout(timer)); });
  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.store
      .patients()
      .filter(
        (p) =>
          (!this.status() || p.status === this.status()) &&
          `${p.firstName} ${p.lastName} ${p.mrn} ${p.phone}`.toLowerCase().includes(q),
      );
  });
  readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    middleName: [''],
    lastName: ['', Validators.required],
    dob: ['', Validators.required],
    gender: ['Female', Validators.required],
    bloodGroup: ['Unknown'],
    phone: ['', [Validators.required, Validators.pattern(/^[+\d][\d\s-]{7,}$/)]],
    email: ['', Validators.email],
    city: [''],
    emergencyContact: [''],
    allergies: [''],
  });
  ngOnInit(){}
  age(dob: string) {
    const d = new Date(dob),
      n = new Date();
    return (
      n.getFullYear() -
      d.getFullYear() -
      (n < new Date(n.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0)
    );
  }
  open(id: string) {
    void this.router.navigate(['/patients', id]);
  }
  openCreate() {
    this.editingId.set(null);
    this.form.reset({ gender: 'Female', bloodGroup: 'Unknown' });
    this.drawerOpen.set(true);
  }
  openEdit(patient: Patient) {
    this.editingId.set(patient.id);
    this.form.reset({ ...patient, allergies: patient.allergies.join(', ') });
    this.drawerOpen.set(true);
    this.menuId.set(null);
  }
  closeDrawer() {
    if (this.form.dirty && !confirm('Discard unsaved changes?')) return;
    this.drawerOpen.set(false);
    this.form.reset();
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    const value = this.form.getRawValue(),
      data = {
        ...value,
        allergies: value.allergies
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        status: 'Active' as const,
      };
    try {
      const id = this.editingId();
      if (id) {
        await this.store.update(id, data);
        this.toast.success('Patient updated successfully.');
      } else {
        await this.store.create(data);
        this.toast.success('Patient created successfully.');
      }
      this.drawerOpen.set(false);
      this.form.reset();
    } catch (e) {
      this.toast.error((e as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }
  async deactivate(patient: Patient) {
    this.menuId.set(null);
    const ok = await this.confirmation.confirm({
      title: 'Deactivate patient?',
      message: 'The patient will no longer be available for new operational workflows.',
      context: `${patient.firstName} ${patient.lastName} · ${patient.mrn}`,
      confirmLabel: 'Deactivate',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.store.archive(patient.id);
      this.toast.success('Patient deactivated successfully.');
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
  export() {
    const rows = [
      ['MRN', 'Name', 'Phone', 'Status'],
      ...this.filtered().map((p) => [p.mrn, `${p.firstName} ${p.lastName}`, p.phone, p.status]),
    ];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'patients.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
