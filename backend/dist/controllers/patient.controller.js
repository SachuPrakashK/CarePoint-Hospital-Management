import { patientService } from '../services/patient.service.js';
import { asyncHandler } from '../utils/async-handler.js';
export const list = asyncHandler(async (req, res) => res.json(await patientService.list(req.query)));
export const details = asyncHandler(async (req, res) => res.json({ data: await patientService.details(String(req.params.id)) }));
export const create = asyncHandler(async (req, res) => res.status(201).json({ data: await patientService.create(req.body), message: 'Patient created successfully.' }));
export const update = asyncHandler(async (req, res) => res.json({ data: await patientService.update(String(req.params.id), req.body), message: 'Patient updated successfully.' }));
export const archive = asyncHandler(async (req, res) => res.json({ data: await patientService.archive(String(req.params.id)), message: 'Patient archived successfully.' }));
