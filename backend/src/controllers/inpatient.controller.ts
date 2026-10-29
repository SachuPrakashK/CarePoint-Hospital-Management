import { asyncHandler } from '../utils/async-handler.js';
import { inpatientService as s } from '../services/inpatient.service.js';
const id = (q: any) => String(q.params.id);
export const list = asyncHandler(async (q, r) => r.json(await s.list(q.query)));
export const details = asyncHandler(async (q, r) => r.json({ data: await s.details(id(q)) }));
export const clinicalRecords = asyncHandler(async (q, r) =>
  r.json({ data: await s.clinicalRecords(id(q)) }),
);
export const admissionNursing = asyncHandler(async (q, r) =>
  r.json({ data: await s.admissionNursing(id(q)) }),
);
export const bedHistory = asyncHandler(async (q, r) => r.json({ data: await s.bedHistory(id(q)) }));
export const admissionMedications = asyncHandler(async (q, r) =>
  r.json({ data: await s.admissionMedications(id(q)) }),
);
export const admissionLaboratory = asyncHandler(async (q, r) =>
  r.json({ data: await s.admissionLaboratory(id(q)) }),
);
export const admissionRadiology = asyncHandler(async (q, r) =>
  r.json({ data: await s.admissionRadiology(id(q)) }),
);
export const create = asyncHandler(async (q, r) =>
  r.status(201).json({ data: await s.admit(q.body, q.auth!.userId) }),
);
export const update = asyncHandler(async (q, r) => r.json({ data: await s.update(id(q), q.body) }));
export const transfer = asyncHandler(async (q, r) =>
  r.json({ data: await s.transfer(id(q), q.body, q.auth!.userId) }),
);
export const discharge = asyncHandler(async (q, r) =>
  r.json({ data: await s.discharge(id(q), q.body, q.auth!.userId) }),
);
export const wards = asyncHandler(async (_q, r) => r.json({ data: await s.wards() }));
export const rooms = asyncHandler(async (_q, r) => r.json({ data: await s.rooms() }));
export const beds = asyncHandler(async (_q, r) => r.json({ data: await s.beds() }));
export const availableBeds = asyncHandler(async (_q, r) =>
  r.json({ data: await s.availableBeds() }),
);
export const lookups = asyncHandler(async (_q, r) => r.json({ data: await s.lookups() }));
export const createWard = asyncHandler(async (q, r) =>
  r.status(201).json({ data: await s.createWard(q.body, q.auth!.userId) }),
);
export const updateWard = asyncHandler(async (q, r) =>
  r.json({ data: await s.updateWard(id(q), q.body) }),
);
export const createRoom = asyncHandler(async (q, r) =>
  r.status(201).json({ data: await s.createRoom(q.body) }),
);
export const updateRoom = asyncHandler(async (q, r) =>
  r.json({ data: await s.updateRoom(id(q), q.body) }),
);
export const createBed = asyncHandler(async (q, r) =>
  r.status(201).json({ data: await s.createBed(q.body) }),
);
export const updateBed = asyncHandler(async (q, r) =>
  r.json({ data: await s.updateBed(id(q), q.body) }),
);
export const assignedPatients = asyncHandler(async (q, r) =>
  r.json({ data: await s.assignedPatients(q.auth!.userId, q.auth!.roles) }),
);
export const nursingStaff = asyncHandler(async (_q, r) => r.json({ data: await s.nursingStaff() }));
export const nursingNotes = asyncHandler(async (q, r) =>
  r.json({
    data: await s.nursingNotes(
      q.auth!.userId,
      q.auth!.roles,
      q.query.admission_id ? String(q.query.admission_id) : undefined,
    ),
  }),
);
export const addNursingNote = asyncHandler(async (q, r) =>
  r.status(201).json({ data: await s.addNursingNote(q.body, q.auth!.userId, q.auth!.roles) }),
);
export const medications = asyncHandler(async (q, r) =>
  r.json({
    data: await s.medications(
      q.auth!.userId,
      q.auth!.roles,
      q.query.admission_id ? String(q.query.admission_id) : undefined,
    ),
  }),
);
export const administerMedication = asyncHandler(async (q, r) =>
  r.json({ data: await s.administerMedication(id(q), q.body, q.auth!.userId, q.auth!.roles) }),
);
export const handovers = asyncHandler(async (q, r) =>
  r.json({
    data: await s.handovers(
      q.auth!.userId,
      q.auth!.roles,
      q.query.admission_id ? String(q.query.admission_id) : undefined,
    ),
  }),
);
export const createHandover = asyncHandler(async (q, r) =>
  r.status(201).json({ data: await s.createHandover(q.body, q.auth!.userId, q.auth!.roles) }),
);
export const acknowledgeHandover = asyncHandler(async (q, r) =>
  r.json({ data: await s.acknowledgeHandover(id(q), q.auth!.userId, q.auth!.roles) }),
);
export const procedures = asyncHandler(async (q, r) => r.json(await s.procedures(q.query)));
export const procedureDetails = asyncHandler(async (q, r) =>
  r.json({ data: await s.procedureDetails(id(q)) }),
);
export const procedureLookups = asyncHandler(async (_q, r) =>
  r.json({ data: await s.procedureLookups() }),
);
export const procedureStats = asyncHandler(async (_q, r) =>
  r.json({ data: await s.procedureStats() }),
);
export const scheduleProcedure = asyncHandler(async (q, r) =>
  r.status(201).json({ data: await s.scheduleProcedure(q.body, q.auth!.userId) }),
);
export const updateProcedure = asyncHandler(async (q, r) =>
  r.json({ data: await s.updateProcedure(id(q), q.body, q.auth!.userId) }),
);
