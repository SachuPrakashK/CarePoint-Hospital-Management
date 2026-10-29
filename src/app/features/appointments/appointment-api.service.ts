import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
export interface ApiAppointment {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientGender: string | null;
  patientPhone: string | null;
  patientAge: string | null;
  departmentId: string;
  department: string;
  doctorId: string;
  doctor: string;
  doctorSpecialty: string | null;
  appointmentAt: string;
  status: string;
  type: string;
  consultationType: string;
  reason: string;
  fee: number;
  createdAt: string;
  updatedAt: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  paymentStatus: 'Paid' | 'Pending' | 'Partially Paid' | 'Refunded' | 'Not Billed';
  outstandingBalance: number;
}
export interface AppointmentPatientOption {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  mrn: string;
  gender: string;
  phone: string;
  dob: string;
}
export interface AppointmentOptions {
  patients: AppointmentPatientOption[];
  departments: { id: string; name: string }[];
  doctors: {
    id: string;
    firstName: string;
    lastName: string;
    departmentId: string | null;
    consultationFee: number | null;
    specialization: { name: string } | null;
  }[];
}
export interface AppointmentSummary {
  today: number;
  confirmed: number;
  pendingPayment: number;
  completed: number;
  scope: string;
}
export interface AppointmentInvoice {
  id: string;
  number: string;
  appointmentNumber: string;
  paymentStatus: string;
  total: number;
  paidAmount: number;
  balance: number;
}
export interface AppointmentQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  doctorId?: string;
  status?: string;
  gender?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
export interface AppointmentPage {
  data: ApiAppointment[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}
@Injectable({ providedIn: 'root' })
export class AppointmentApiService {
  private http = inject(HttpClient);
  list(query: AppointmentQuery = {}) {
    let params = new HttpParams();
    const values: Record<string, string | number | undefined> = {
      page: query.page,
      page_size: query.pageSize,
      search: query.search,
      department_id: query.departmentId,
      doctor_id: query.doctorId,
      status: query.status,
      gender: query.gender,
      payment_status: query.paymentStatus,
      start_date: query.startDate,
      end_date: query.endDate,
      sort_by: query.sortBy,
      sort_order: query.sortOrder,
    };
    for (const [key, value] of Object.entries(values))
      if (value !== undefined && value !== '') params = params.set(key, value);
    return this.http.get<AppointmentPage>('/api/v1/appointments', { params });
  }
  get(id: string) {
    return this.http.get<{ data: ApiAppointment }>(`/api/v1/appointments/${id}`);
  }
  options() {
    return this.http.get<{ data: AppointmentOptions }>('/api/v1/appointments/options');
  }
  summary() {
    return this.http.get<{ data: AppointmentSummary }>('/api/v1/appointments/summary');
  }
  searchPatients(search: string) {
    return this.http.get<{ data: AppointmentPatientOption[] }>(
      '/api/v1/appointments/patients/search',
      { params: { search } },
    );
  }
  availability(doctorId: string, date: string, appointmentId?: string) {
    let params = new HttpParams().set('doctor_id', doctorId).set('date', date);
    if (appointmentId) params = params.set('appointment_id', appointmentId);
    return this.http.get<{
      data: { date: string; doctorId: string; slots: { time: string; available: boolean }[] };
    }>('/api/v1/appointments/availability', { params });
  }
  create(value: any) {
    return this.http.post<{ data: ApiAppointment }>('/api/v1/appointments', value);
  }
  update(id: string, value: any) {
    return this.http.put<{ data: ApiAppointment }>(`/api/v1/appointments/${id}`, value);
  }
  status(id: string, status: string) {
    return this.http.patch<{ data: ApiAppointment }>(`/api/v1/appointments/${id}/status`, {
      status,
    });
  }
  reschedule(
    id: string,
    value: { departmentId: string; doctorId: string; appointmentAt: string; reason: string },
  ) {
    return this.http.patch<{ data: ApiAppointment }>(
      `/api/v1/appointments/${id}/reschedule`,
      value,
    );
  }
  invoice(id: string) {
    return this.http.get<{ data: AppointmentInvoice & Record<string, unknown> }>(
      `/api/v1/appointments/${id}/invoice`,
    );
  }
  invoicePdf(id: string) {
    return this.http.get(`/api/v1/appointments/${id}/invoice.pdf`, {
      observe: 'response',
      responseType: 'blob',
    });
  }
}
