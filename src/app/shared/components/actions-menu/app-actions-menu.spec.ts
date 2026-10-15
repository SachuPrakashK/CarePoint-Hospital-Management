import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AppActionsMenu } from './app-actions-menu';

describe('AppActionsMenu edit action', () => {
  let fixture: ComponentFixture<AppActionsMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AppActionsMenu] }).compileComponents();
    fixture = TestBed.createComponent(AppActionsMenu);
    fixture.componentRef.setInput('id', 'role-1');
    fixture.componentInstance.toggle({
      stopPropagation() {},
      currentTarget: document.createElement('button'),
    } as unknown as MouseEvent);
    fixture.detectChanges();
  });

  it('emits Edit for an editable record', () => {
    let emitted = false;
    fixture.componentInstance.edit.subscribe(() => (emitted = true));
    const button = fixture.debugElement.queryAll(By.css('[role="menuitem"]'))
      .find((item) => item.nativeElement.textContent.includes('Edit'))!;

    button.nativeElement.click();

    expect(emitted).toBe(true);
  });

  it('keeps Edit visible but disabled for a protected record', () => {
    fixture.componentRef.setInput('editDisabled', true);
    fixture.componentRef.setInput('editDisabledReason', 'Protected system roles cannot be edited');
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.debugElement.queryAll(By.css('[role="menuitem"]'))
      .find((item) => item.nativeElement.textContent.includes('Edit'))!.nativeElement;

    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Protected system roles cannot be edited');
  });
});
