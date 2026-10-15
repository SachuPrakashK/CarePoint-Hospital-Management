import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentStore } from './document.store';

describe('DocumentStore validation', () => {
  let store: DocumentStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(DocumentStore);
  });

  it('accepts an approved document type', () => {
    const file = new File(['report'], 'report.pdf', { type: 'application/pdf' });
    expect(() => store.validate(file)).not.toThrow();
  });

  it('rejects executable files', () => {
    const file = new File(['unsafe'], 'unsafe.exe', { type: 'application/x-msdownload' });
    expect(() => store.validate(file)).toThrowError(/Only PDF/);
  });

  it('rejects files larger than 10 MB', () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', {
      type: 'application/pdf',
    });
    expect(() => store.validate(file)).toThrowError(/10 MB/);
  });
});
