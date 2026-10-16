import { Directive, ElementRef, HostListener, inject, output } from '@angular/core';

@Directive({ selector: '[appClickOutside]' })
export class ClickOutsideDirective {
  private readonly element = inject(ElementRef<HTMLElement>);
  readonly appClickOutside = output<void>();

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null) {
    if (target instanceof Node && !this.element.nativeElement.contains(target)) {
      this.appClickOutside.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.appClickOutside.emit();
  }
}
