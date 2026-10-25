import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SummaryCard } from './summary-card';

describe('SummaryCard', () => {
  let fixture: ComponentFixture<SummaryCard>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SummaryCard] }).compileComponents();
    fixture = TestBed.createComponent(SummaryCard);
    fixture.componentRef.setInput('title', 'Available Beds');
    fixture.componentRef.setInput('value', 24);
    fixture.componentRef.setInput('icon', 'bed');
    fixture.componentRef.setInput('variant', 'green');
    fixture.detectChanges();
  });
  it('renders its API-backed value and semantic icon', () => {
    expect(fixture.nativeElement.querySelector('.summary-card__title').textContent).toContain(
      'Available Beds',
    );
    expect(fixture.nativeElement.querySelector('.summary-card__value').textContent).toContain('24');
    expect(fixture.nativeElement.querySelector('app-icon')).not.toBeNull();
  });
  it('applies the configured color variant', () => {
    expect(fixture.nativeElement.querySelector('.summary-card').classList).toContain(
      'summary-card--green',
    );
  });
});
