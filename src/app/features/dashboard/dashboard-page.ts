import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardStore } from './dashboard.store';
import { PatientVisitsChart } from './components/patient-visits-chart/patient-visits-chart';
import { AppointmentsDepartmentChart } from './components/appointments-department-chart/appointments-department-chart';
import { AppointmentStatusChart } from './components/appointment-status-chart/appointment-status-chart';

@Component({
  imports: [RouterLink, PatientVisitsChart, AppointmentsDepartmentChart, AppointmentStatusChart], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-head"><div><h1>Dashboard</h1><p class="muted">Operational information from the hospital API.</p></div><a class="primary button-link" routerLink="/appointments/new">+ New appointment</a></div>
    @if (store.error(); as error) { <div class="error-state" role="alert">{{ error }} <button class="secondary" (click)="store.load()">Retry</button></div> }
    @if (store.loading() && !store.summary()) { <div class="card empty">Loading dashboard…</div> } @else {
      <section class="stats">@for (item of store.stats(); track item.label) { <article class="card stat"><span class="muted">{{item.label}}</span><div class="value">{{item.value}}</div><span class="trend">{{item.note}}</span></article> }</section>
      <section class="dashboard-charts">
        <article class="card chart-card"><div class="section-title"><h2>Patient trends</h2></div><app-patient-visits-chart [data]="store.patientTrends()" /></article>
        <article class="card chart-card"><div class="section-title"><h2>Appointments by department</h2></div><app-appointments-department-chart [data]="store.departmentAppointments()" /></article>
        <article class="card chart-card"><div class="section-title"><h2>Appointment status</h2></div><app-appointment-status-chart [data]="store.appointmentStatuses()" /></article>
      </section>
      <section class="card"><div class="section-title"><h2>Recent appointments</h2><a routerLink="/appointments">View all</a></div><div class="table-wrap"><table><thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th></tr></thead><tbody>@for (item of store.recentAppointments(); track item.id) {<tr><td>{{item.appointment_at}}</td><td><b>{{item.patient_name}}</b><br><small class="muted">{{item.number}}</small></td><td>{{item.doctor_name}}</td><td><span class="status">{{item.status}}</span></td></tr>} @empty {<tr><td colspan="4" class="empty">No recent appointments.</td></tr>}</tbody></table></div></section>
    }`,
  styles: [`.dashboard-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:20px 0}.chart-card{min-width:0;padding:18px}.chart-card:first-child{grid-column:1/-1}@media(max-width:800px){.dashboard-charts{grid-template-columns:1fr}.chart-card:first-child{grid-column:auto}}`],
})
export class DashboardPage implements OnInit { readonly store=inject(DashboardStore); ngOnInit(){this.store.load();} }
