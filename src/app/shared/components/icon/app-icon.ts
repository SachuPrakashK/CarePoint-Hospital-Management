import { ChangeDetectionStrategy, Component, input } from '@angular/core';
@Component({selector:'app-icon',templateUrl:'./app-icon.html',styleUrl:'./app-icon.scss',changeDetection:ChangeDetectionStrategy.OnPush})export class AppIcon{name=input.required<string>();size=input(20);}
