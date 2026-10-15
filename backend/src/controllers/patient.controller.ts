import type { RequestHandler } from 'express';
import { patientService } from '../services/patient.service.js';
import { asyncHandler } from '../utils/async-handler.js';
export const list: RequestHandler = asyncHandler(async (req, res) =>
  res.json(await patientService.list(req.query as never)),
);
export const details: RequestHandler = asyncHandler(async (req, res) =>
  res.json({ data: await patientService.details(String(req.params.id)) }),
);
export const appointments: RequestHandler = asyncHandler(async (req, res) =>
  res.json({ data: await patientService.appointments(String(req.params.id)) }),
);
export const visits: RequestHandler = asyncHandler(async (req, res) =>
  res.json({ data: await patientService.visits(String(req.params.id)) }),
);
export const prescriptions: RequestHandler = asyncHandler(async (req, res) =>
  res.json({ data: await patientService.prescriptions(String(req.params.id)) }),
);
export const medicalRecords: RequestHandler = asyncHandler(async (req, res) =>
  res.json({ data: await patientService.medicalRecords(String(req.params.id)) }),
);
export const create: RequestHandler = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({
      data: await patientService.create(req.body),
      message: 'Patient created successfully.',
    }),
);
export const update: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    data: await patientService.update(String(req.params.id), req.body),
    message: 'Patient updated successfully.',
  }),
);
export const archive: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    data: await patientService.archive(String(req.params.id)),
    message: 'Patient archived successfully.',
  }),
);
