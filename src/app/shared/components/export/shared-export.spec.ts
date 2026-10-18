import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedExport } from './shared-export';

describe('SharedExport', () => {
  let fixture: ComponentFixture<SharedExport>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SharedExport] }).compileComponents();
    fixture = TestBed.createComponent(SharedExport);
    fixture.detectChanges();
  });
  it('emits once when enabled', () => {
    let requests = 0;
    fixture.componentInstance.exportRequested.subscribe(() => requests++);
    fixture.nativeElement.querySelector('button').click();
    expect(requests).toBe(1);
  });
  it('blocks interaction and exposes busy state while exporting', () => {
    fixture.componentRef.setInput('exporting', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});
