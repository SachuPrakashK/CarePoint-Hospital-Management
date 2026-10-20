import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { AppIcon } from '../icon/app-icon';

let nextFileUploadId = 0;

@Component({
  selector: 'app-shared-file-upload',
  imports: [AppIcon],
  templateUrl: './shared-file-upload.html',
  styleUrl: './shared-file-upload.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedFileUpload {
  readonly accept = input('');
  readonly allowedTypes = input<readonly string[]>([]);
  readonly maxSize = input(10 * 1024 * 1024);
  readonly formatsLabel = input('supported files');
  readonly selected = input<File | null>(null);
  readonly disabled = input(false);
  readonly uploading = input(false);
  readonly progress = input<number | null>(null);
  readonly error = input('');

  readonly selectedChange = output<File | null>();
  readonly validationError = output<string>();
  readonly dragging = signal(false);
  readonly inputId = `shared-file-upload-${++nextFileUploadId}`;

  onFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.select(file);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (!this.disabled()) this.dragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled()) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.select(file);
  }

  remove() {
    if (!this.disabled()) this.selectedChange.emit(null);
  }

  formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private select(file: File) {
    if (file.size > this.maxSize()) {
      this.validationError.emit(`File must be ${this.formatSize(this.maxSize())} or smaller.`);
      return;
    }
    const allowed = this.allowedTypes();
    if (allowed.length && !allowed.includes(file.type)) {
      this.validationError.emit(`Only ${this.formatsLabel()} files are allowed.`);
      return;
    }
    this.selectedChange.emit(file);
  }
}
