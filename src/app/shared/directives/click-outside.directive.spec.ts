import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ClickOutsideDirective } from './click-outside.directive';

describe('ClickOutsideDirective', () => {
  it('emits only for clicks outside its host', () => {
    const host = document.createElement('div');
    const child = document.createElement('button');
    host.append(child);
    TestBed.configureTestingModule({
      providers: [ClickOutsideDirective, { provide: ElementRef, useValue: new ElementRef(host) }],
    });
    const directive = TestBed.inject(ClickOutsideDirective);
    const emitted = vi.fn();
    directive.appClickOutside.subscribe(emitted);
    directive.onDocumentClick(child);
    expect(emitted).not.toHaveBeenCalled();
    directive.onDocumentClick(document.body);
    expect(emitted).toHaveBeenCalledOnce();
  });
});
