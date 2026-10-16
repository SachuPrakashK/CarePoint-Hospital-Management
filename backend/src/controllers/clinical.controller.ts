import { asyncHandler } from '../utils/async-handler.js';
import { clinicalService as s } from '../services/clinical.service.js';
const id = (req: any) => String(req.params.id);
export const consultations = asyncHandler(async (_req,res)=>res.json({data:await s.consultations()}));
export const summary = asyncHandler(async (req, res) =>
  res.json({ data: await s.summary(id(req)) }),
);
export const timeline = asyncHandler(async (req, res) =>
  res.json({ data: await s.timeline(id(req), req.query) }),
);
export const consultation = asyncHandler(async (req, res) =>
  res.json({ data: await s.consultation(id(req)) }),
);
export const createConsultation = asyncHandler(async (req, res) =>
  res.status(201).json({ data: await s.createConsultation(req.body, req.auth!.userId) }),
);
export const updateConsultation = asyncHandler(async (req, res) =>
  res.json({ data: await s.updateConsultation(id(req), req.body) }),
);
export const createVital = asyncHandler(async (req, res) =>
  res.status(201).json({ data: await s.createVital(req.body, req.auth!.userId) }),
);
export const vitals = asyncHandler(async (req, res) => res.json({ data: await s.vitals(id(req)) }));
export const createDiagnosis = asyncHandler(async (req, res) =>
  res.status(201).json({ data: await s.createDiagnosis(req.body) }),
);
export const updateDiagnosis = asyncHandler(async (req, res) =>
  res.json({ data: await s.updateDiagnosis(id(req), req.body) }),
);
export const createPrescription = asyncHandler(async (req, res) =>
  res.status(201).json({ data: await s.createPrescription(req.body, req.auth!.userId) }),
);
export const prescription = asyncHandler(async (req, res) =>
  res.json({ data: await s.prescription(id(req)) }),
);
export const updatePrescription = asyncHandler(async (req, res) =>
  res.json({ data: await s.updatePrescription(id(req), req.body) }),
);
