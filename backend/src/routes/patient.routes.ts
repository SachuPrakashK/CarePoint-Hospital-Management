import { Router } from 'express';
import * as controller from '../controllers/patient.controller.js';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createPatientSchema,
  patientIdSchema,
  patientListSchema,
  updatePatientSchema,
} from '../validators/patient.validator.js';
export const patientRoutes = Router();
patientRoutes.use(authenticate);
patientRoutes.get(
  '/',
  requirePermissions('patients.view'),
  validate(patientListSchema),
  controller.list,
);
patientRoutes.post(
  '/',
  requirePermissions('patients.create'),
  validate(createPatientSchema),
  controller.create,
);
patientRoutes.get(
  '/:id/appointments',
  requirePermissions('patients.view'),
  validate(patientIdSchema),
  controller.appointments,
);
patientRoutes.get(
  '/:id/visits',
  requirePermissions('patients.view'),
  validate(patientIdSchema),
  controller.visits,
);
patientRoutes.get(
  '/:id/prescriptions',
  requirePermissions('patients.view'),
  validate(patientIdSchema),
  controller.prescriptions,
);
patientRoutes.get(
  '/:id/medical-records',
  requirePermissions('patients.view'),
  validate(patientIdSchema),
  controller.medicalRecords,
);
patientRoutes.get(
  '/:id',
  requirePermissions('patients.view'),
  validate(patientIdSchema),
  controller.details,
);
patientRoutes.put(
  '/:id',
  requirePermissions('patients.edit'),
  validate(updatePatientSchema),
  controller.update,
);
patientRoutes.delete(
  '/:id',
  requirePermissions('patients.delete'),
  validate(patientIdSchema),
  controller.archive,
);
