import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './shared/components/toast-container/toast-container';
import { ConfirmationDialog } from './shared/components/confirmation-dialog/confirmation-dialog';
import { GlobalLoader } from './shared/components/global-loader/global-loader';

@Component({
  imports: [RouterOutlet, ToastContainer, ConfirmationDialog, GlobalLoader],
  selector: 'hms-root',
  templateUrl: './app-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
