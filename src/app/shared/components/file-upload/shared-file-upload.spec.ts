import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedFileUpload } from './shared-file-upload';

describe('SharedFileUpload', () => {
  let fixture: ComponentFixture<SharedFileUpload>;
  let component: SharedFileUpload;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SharedFileUpload] }).compileComponents();
    fixture = TestBed.createComponent(SharedFileUpload);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('allowedTypes', ['application/pdf']);
    fixture.componentRef.setInput('maxSize', 1024);
    fixture.componentRef.setInput('formatsLabel', 'PDF');
    fixture.detectChanges();
  });

  it('emits a valid selected file', () => {
    const selected: Array<File | null> = [];
    component.selectedChange.subscribe((file) => selected.push(file));
    const file = new File(['report'], 'report.pdf', { type: 'application/pdf' });
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    expect(selected).toEqual([file]);
  });

  it('rejects unsupported files without selecting them', () => {
    const errors: string[] = [];
    const selected: Array<File | null> = [];
    component.validationError.subscribe((message) => errors.push(message));
    component.selectedChange.subscribe((file) => selected.push(file));
    const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [new File(['unsafe'], 'unsafe.exe', { type: 'application/x-msdownload' })],
    });
    input.dispatchEvent(new Event('change'));
    expect(errors[0]).toContain('Only PDF');
    expect(selected).toEqual([]);
  });

  it('removes only the selected file', () => {
    const selected: Array<File | null> = [];
    fixture.componentRef.setInput(
      'selected',
      new File(['report'], 'report.pdf', { type: 'application/pdf' }),
    );
    component.selectedChange.subscribe((file) => selected.push(file));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.file-upload__remove') as HTMLButtonElement).click();
    expect(selected).toEqual([null]);
  });
});
