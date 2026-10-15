import { ChangeDetectionStrategy, Component,ElementRef,HostListener,inject,input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableColumnDefinition } from '../../models/table.models';

@Component({ selector: 'app-column-config', imports: [FormsModule], templateUrl: './column-config.html', styleUrl: './column-config.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ColumnConfig {
  private host=inject(ElementRef<HTMLElement>);
  columns=input.required<readonly TableColumnDefinition[]>(); visible=input.required<readonly string[]>(); apply=output<string[]>(); reset=output<void>();
  readonly open=signal(false); readonly draft=signal<string[]>([]);
  togglePanel(){if(!this.open())this.draft.set([...this.visible()]);this.open.update(value=>!value);}
  checked(id:string){return this.draft().includes(id);}
  toggle(id:string,checked:boolean){this.draft.update(ids=>checked?[...ids,id]:ids.filter(value=>value!==id));}
  submit(){this.apply.emit(this.draft());this.open.set(false);}
  resetDefaults(){this.reset.emit();this.open.set(false);}
  @HostListener('document:click',['$event']) closeOutside(event:Event){if(this.open()&&!this.host.nativeElement.contains(event.target as Node))this.open.set(false);}
  @HostListener('document:keydown.escape') closeOnEscape(){this.open.set(false);}
}
