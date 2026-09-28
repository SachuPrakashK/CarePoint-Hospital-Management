import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClinicalStore } from '../../../core/services/clinical.store';
@Component({
  imports: [RouterLink],
  template: `<div class="page-head">
      <div>
        <div class="breadcrumbs">Appointments</div>
        <h1>Appointments</h1>
        <p class="muted">Coordinate bookings, availability, walk-ins and follow-ups.</p>
      </div>
      <a class="primary button-link" routerLink="new">+ New appointment</a>
    </div>
    <div class="tabs">
      <button [class.active]="view() === 'list'" (click)="view.set('list')">List</button
      ><button [class.active]="view() === 'calendar'" (click)="view.set('calendar')">
        Calendar
      </button>
    </div>
    <section class="card">
      <div class="toolbar">
        <label class="search-box"
          >⌕<input placeholder="Search" #q (input)="search.set(q.value)" /></label
        ><select aria-label="Status filter" #s (change)="status.set(s.value)">
          <option value="">All statuses</option>
          <option>Scheduled</option>
          <option>Confirmed</option>
          <option>Waiting</option>
          <option>Completed</option>
          <option>Cancelled</option></select
        ><button class="secondary">Department</button><button class="secondary">Doctor</button>
      </div>
      @if (view() === 'list') {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Appointment</th>
                <th>Patient</th>
                <th>Department / Doctor</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (a of filtered(); track a.id) {
                <tr>
                  <td>
                    <b>{{ a.date }}</b
                    ><br />{{ a.time }}
                  </td>
                  <td>{{ a.number }}</td>
                  <td>
                    <b>{{ a.patientName }}</b>
                  </td>
                  <td>
                    {{ a.department }}<br /><small>{{ a.doctor }}</small>
                  </td>
                  <td>{{ a.type }}</td>
                  <td>
                    <span class="status" [class.warn]="a.status === 'Waiting'">{{ a.status }}</span>
                  </td>
                  <td class="actions">
                    <button (click)="checkIn(a.id)">Check in</button
                    ><button aria-label="More actions">•••</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty">No appointments found.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="calendar">
          <div class="calendar-head">
            <button class="secondary">‹</button><b>This week</b><button class="secondary">›</button>
          </div>
          <div class="week">
            @for (day of days; track day) {
              <div class="day">
                <b>{{ day }}</b>
                @for (a of store.appointments(); track a.id) {
                  <article class="event">
                    <small>{{ a.time }}</small
                    ><strong>{{ a.patientName }}</strong
                    ><span>{{ a.doctor }}</span>
                  </article>
                }
              </div>
            }
          </div>
        </div>
      }
    </section>`,
  styles: [
    `
      .calendar {
        padding: 16px;
      }
      .calendar-head {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
        margin-bottom: 16px;
      }
      .week {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
        min-width: 760px;
      }
      .calendar {
        overflow: auto;
      }
      .day {
        border: 1px solid #e0e8ea;
        border-radius: 7px;
        min-height: 350px;
        padding: 10px;
      }
      .day > b {
        display: block;
        margin-bottom: 12px;
      }
      .event {
        display: grid;
        gap: 4px;
        background: #e9f6f3;
        border-left: 3px solid #15927b;
        padding: 9px;
        margin-bottom: 8px;
        border-radius: 4px;
      }
      .event span {
        font-size: 11px;
        color: #5d7279;
      }
    `,
  ],
})
export class AppointmentList {
  readonly store = inject(ClinicalStore);
  readonly search = signal('');
  readonly status = signal('');
  readonly view = signal<'list' | 'calendar'>('list');
  readonly days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  readonly filtered = computed(() =>
    this.store
      .appointments()
      .filter(
        (a) =>
          (!this.status() || a.status === this.status()) &&
          `${a.patientName} ${a.number} ${a.doctor}`
            .toLowerCase()
            .includes(this.search().toLowerCase()),
      ),
  );
  checkIn(id: string) {
    this.store.updateStatus(id, 'Checked In');
  }
}
