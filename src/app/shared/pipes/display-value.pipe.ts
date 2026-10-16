import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'displayValue', standalone: true, pure: true })
export class DisplayValuePipe implements PipeTransform {
  transform(value: unknown, fallback = 'Not available'): unknown {
    return value === null || value === undefined || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)
      ? fallback
      : Array.isArray(value) ? value.join(', ') : value;
  }
}
