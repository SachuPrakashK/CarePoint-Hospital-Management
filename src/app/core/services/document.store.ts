import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ManagedDocument } from '../../shared/models/operations.models';
import { DocumentApiService } from './document-api.service';
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'text/plain']);
const MAX_SIZE = 10 * 1024 * 1024;
@Injectable({ providedIn: 'root' })
export class DocumentStore {
  private api = inject(DocumentApiService);
  private state = signal<ManagedDocument[]>([]);
  readonly documents = this.state.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  validate(file: File) {
    if (file.size > MAX_SIZE) throw new Error('File must be 10 MB or smaller.');
    if (!ALLOWED.has(file.type)) throw new Error('Only PDF, JPEG, PNG and text files are allowed.');
  }
  async add(file: File, ownerType: string, ownerId: string, sensitive = true) {
    this.validate(file);
    this.loading.set(true);
    try {
      const r = await firstValueFrom(this.api.upload(file, ownerType, ownerId, sensitive));
      const item = this.api.normalize(r.data);
      this.state.update((v) => [item, ...v]);
      return item;
    } finally {
      this.loading.set(false);
    }
  }
  async loadPatient(patientId: string) {
    const r = await firstValueFrom(this.api.forPatient(patientId));
    this.state.set(r.data.map(this.api.normalize));
  }
  async load(query: {
    page: number;
    pageSize: number;
    search?: string;
    ownerType?: string;
    mimeType?: string;
    sortBy?:string;
    sortOrder?:'asc'|'desc';
  }) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await firstValueFrom(this.api.list(query));
      this.state.set(r.data.map(this.api.normalize));
      this.page.set(r.pagination.page);
      this.pageSize.set(r.pagination.page_size);
      this.total.set(r.pagination.total);
      this.totalPages.set(r.pagination.total_pages);
    } catch {
      this.error.set('Documents could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  async remove(id: string) {
    await firstValueFrom(this.api.remove(id));
    this.state.update((v) => v.filter((x) => x.id !== id));
  }
  async download(id: string, preview = false) {
    const blob = await firstValueFrom(preview ? this.api.preview(id) : this.api.download(id));
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    if (preview) a.target = '_blank';
    else a.download = this.state().find((x) => x.id === id)?.name ?? 'document';
    a.click();
    URL.revokeObjectURL(url);
  }
}
