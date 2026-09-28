import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClinicalStore } from '../../../core/services/clinical.store';
@Component({
  imports: [RouterLink],
  template: `<div class="page-head">
      <div>
        <div class="breadcrumbs">OPD queue</div>
        <h1>OPD queue</h1>
        <p class="muted">Live patient flow for {{ today }}.</p>
      </div>
      <a class="primary button-link" routerLink="/appointments/new">+ Add walk-in</a>
    </div>
    <section class="stats">
      <article class="card stat">
        <span class="muted">Checked in</span>
        <div class="value">{{ count('Checked In') }}</div>
      </article>
      <article class="card stat">
        <span class="muted">Waiting</span>
        <div class="value">{{ count('Waiting') }}</div>
      </article>
      <article class="card stat">
        <span class="muted">In consultation</span>
        <div class="value">{{ count('In Consultation') }}</div>
      </article>
      <article class="card stat">
        <span class="muted">Completed</span>
        <div class="value">{{ count('Completed') }}</div>
      </article>
    </section>
    <section class="card">
      <div class="toolbar">
        <label class="search-box">⌕<input placeholder="Search" /></label
        ><button class="secondary">Doctor</button><button class="secondary">Status</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Appointment</th>
              <th>Waiting</th>
              <th>Status</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            @for (a of store.queue(); track a.id) {
              <tr>
                <td>
                  <strong class="token">{{ a.token }}</strong>
                </td>
                <td>
                  <b>{{ a.patientName }}</b
                  ><br /><small>{{ a.number }}</small>
                </td>
                <td>
                  {{ a.doctor }}<br /><small>{{ a.department }}</small>
                </td>
                <td>{{ a.time }}</td>
                <td>~{{ a.token === 12 ? '18' : '7' }} min</td>
                <td>
                  <span class="status warn">{{ a.status }}</span>
                </td>
                <td>
                  @if (a.status === 'Checked In') {
                    <button class="secondary" (click)="store.updateStatus(a.id, 'Waiting')">
                      Move to waiting
                    </button>
                  } @else if (a.status === 'Waiting') {
                    <a class="primary button-link" [routerLink]="['consultation', a.id]"
                      >Start consultation</a
                    >
                  } @else {
                    <a class="secondary button-link" [routerLink]="['consultation', a.id]">Open</a>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty">The queue is clear.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>`,
  styles: [
    `
      .token {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 9px;
        background: #e3f5f1;
        color: #08715e;
      }
    `,
  ],
})
export class QueuePage {
  readonly store = inject(ClinicalStore);
  today = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date());
  count(s: string) {
    return this.store.todaysAppointments().filter((a) => a.status === s).length;
  }
}
