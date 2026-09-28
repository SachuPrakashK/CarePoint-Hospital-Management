import { Directive, ElementRef, NgZone, OnDestroy, ViewChild, afterNextRender, inject } from '@angular/core';
import * as am5 from '@amcharts/amcharts5';

@Directive()
export abstract class ChartBase implements OnDestroy {
  @ViewChild('chart', { static: true }) protected host!: ElementRef<HTMLDivElement>;
  protected root?: am5.Root;
  protected readonly zone = inject(NgZone);
  private observer?: ResizeObserver;
  constructor() { afterNextRender(() => this.mount()); }
  protected abstract build(root: am5.Root): void;
  private mount(): void {
    if (this.root) return;
    this.zone.runOutsideAngular(() => {
      this.root = am5.Root.new(this.host.nativeElement);
      this.root.setThemes([]);
      this.build(this.root);
      this.observer = new ResizeObserver(() => this.root?.resize());
      this.observer.observe(this.host.nativeElement);
    });
  }
  ngOnDestroy(): void { this.observer?.disconnect(); this.root?.dispose(); this.root = undefined; }
}

