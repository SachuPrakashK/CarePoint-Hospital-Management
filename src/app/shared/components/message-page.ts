import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
@Component({ imports: [RouterLink], templateUrl: './message-page.html' })
export class MessagePage {
  data = inject(ActivatedRoute).snapshot.data;
}
