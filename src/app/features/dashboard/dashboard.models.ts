export interface DashboardSummary {
  total_patients: number;
  appointments_today: number;
  current_admissions: number;
  available_beds: number;
  pending_laboratory: number;
  pending_radiology: number;
  low_stock_items: number;
  revenue_received: number;
  open_insurance_claims: number;
  available_ambulances: number;
}
export interface PatientTrend {
  date: string;
  count: number;
}
export interface OperationalDatum {
  label: string;
  count: number;
}
export interface DepartmentAppointments {
  department: string;
  count: number;
}
export interface AppointmentStatusDatum {
  status: string;
  count: number;
}
export interface RecentAppointment {
  id: string;
  number: string;
  appointment_at: string;
  status: string;
  patient_name: string;
  doctor_name: string;
  department_name: string;
}
