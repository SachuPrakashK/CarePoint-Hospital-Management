export type LabStatus =
  | 'Ordered'
  | 'Sample Collected'
  | 'Processing'
  | 'Result Entered'
  | 'Verified'
  | 'Completed'
  | 'Cancelled';
export interface LabResult {
  test: string;
  value: string;
  unit: string;
  referenceRange: string;
  abnormal: boolean;
  notes?: string;
  enteredBy: string;
  enteredAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
}
export interface LabOrder {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  doctor: string;
  tests: string[];
  priority: 'Routine' | 'Urgent' | 'STAT';
  clinicalNotes: string;
  sampleType: string;
  collectedAt?: string;
  collectedBy?: string;
  results: LabResult[];
  status: LabStatus;
  version: number;
}
export type RadiologyStatus =
  'Ordered' | 'Scheduled' | 'Performed' | 'Reporting' | 'Verified' | 'Completed' | 'Cancelled';
export interface RadiologyOrder {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  investigation: string;
  doctor: string;
  scheduledAt?: string;
  findings?: string;
  impression?: string;
  reportedBy?: string;
  verifiedBy?: string;
  attachmentRef?: string;
  status: RadiologyStatus;
}
export type BedStatus =
  'Available' | 'Occupied' | 'Reserved' | 'Cleaning' | 'Maintenance' | 'Blocked';
export interface Bed {
  id: string;
  name: string;
  room: string;
  roomType: string;
  ward: string;
  floor: string;
  status: BedStatus;
  patientId?: string;
  admissionId?: string;
}
export type AdmissionStatus =
  'Admitted' | 'Transferred' | 'Discharge Planned' | 'Discharged' | 'Cancelled';
export interface BedAllocation {
  id: string;
  bedId: string;
  ward: string;
  room: string;
  startedAt: string;
  endedAt?: string;
  reason: 'Admission' | 'Transfer' | 'Release';
}
export interface Admission {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  admittedAt: string;
  type: 'Emergency' | 'Planned' | 'Transfer';
  department: string;
  attendingDoctor: string;
  reason: string;
  initialDiagnosis: string;
  notes: string;
  status: AdmissionStatus;
  allocations: BedAllocation[];
  dischargedAt?: string;
  dischargeSummaryId?: string;
}
export interface NursingNote {
  id: string;
  admissionId: string;
  patientId: string;
  recordedAt: string;
  nurse: string;
  observation: string;
  intervention: string;
  notes: string;
}
export type MedicationStatus = 'Scheduled' | 'Administered' | 'Missed' | 'Refused' | 'Held';
export interface MedicationAdministration {
  id: string;
  admissionId: string;
  patientId: string;
  medication: string;
  scheduledAt: string;
  dose: string;
  route: string;
  administeredAt?: string;
  administeredBy?: string;
  status: MedicationStatus;
  notes: string;
}
export interface IntakeOutput {
  id: string;
  admissionId: string;
  patientId: string;
  kind: 'Input' | 'Output';
  category: 'Oral' | 'IV' | 'Urine' | 'Drain' | 'Other';
  amountMl: number;
  recordedAt: string;
  recordedBy: string;
}
export interface CarePlan {
  id: string;
  admissionId: string;
  patientId: string;
  problem: string;
  goal: string;
  intervention: string;
  notes: string;
  status: 'Active' | 'Achieved' | 'On Hold' | 'Closed';
  reviewDate: string;
}
export type ProcedureStatus = 'Planned' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
export interface Procedure {
  id: string;
  patientId: string;
  patientName: string;
  admissionId?: string;
  name: string;
  doctor: string;
  team: string[];
  scheduledAt: string;
  location: string;
  indication: string;
  notes: string;
  status: ProcedureStatus;
  theatre?: string;
  durationMinutes?: number;
  preOpChecklist?: string[];
  postOpNotes?: string;
  complications?: string;
}
export interface DischargeSummary {
  id: string;
  admissionId: string;
  patientId: string;
  dischargedAt: string;
  finalDiagnosis: string;
  treatmentSummary: string;
  procedures: string;
  investigationSummary: string;
  conditionAtDischarge: string;
  medications: string;
  instructions: string;
  followUp: string;
  attendingDoctor: string;
}
export type TimelineType =
  | 'Registration'
  | 'Appointment'
  | 'Consultation'
  | 'Diagnosis'
  | 'Prescription'
  | 'Lab Order'
  | 'Lab Result'
  | 'Radiology Order'
  | 'Radiology Report'
  | 'Admission'
  | 'Bed Transfer'
  | 'Procedure'
  | 'Medication'
  | 'Discharge';
export interface TimelineEvent {
  id: string;
  patientId: string;
  occurredAt: string;
  type: TimelineType;
  title: string;
  description: string;
  referenceId?: string;
  actor: string;
}
export interface AuditEvent {
  id: string;
  occurredAt: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
}
