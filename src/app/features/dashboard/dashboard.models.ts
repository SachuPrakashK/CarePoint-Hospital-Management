export interface DashboardSummary { total_patients: number; appointments_today: number; current_admissions: number; available_beds: number; }
export interface PatientTrend { date: string; count: number; }
export interface DepartmentAppointments { department: string; count: number; }
export interface AppointmentStatusDatum { status: string; count: number; }
export interface RecentAppointment { id: string; number: string; appointment_at: string; status: string; patient_name: string; doctor_name: string; }

