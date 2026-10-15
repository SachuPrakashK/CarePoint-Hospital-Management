import { asyncHandler } from '../utils/async-handler.js';
import { documentService as s } from '../services/document.service.js';
import { AppError } from '../utils/app-error.js';
const id = (q: any) => String(q.params.id);
export const upload = asyncHandler(async (q, r) => {
  if (!q.file) throw new AppError(422, 'A file is required.', 'VALIDATION_ERROR');
  r.status(201).json({ data: await s.upload(q.file, q.body, q.auth!.userId) });
});
export const details = asyncHandler(async (q, r) => r.json({ data: await s.details(id(q)) }));
export const download = asyncHandler(async (q, r) => {
  const { row, data } = await s.download(id(q), q.auth!.userId);
  r.setHeader('content-type', row.mimeType);
  r.setHeader(
    'content-disposition',
    `attachment; filename="${encodeURIComponent(row.originalName)}"`,
  );
  r.send(data);
});
export const preview = asyncHandler(async (q, r) => {
  const { row, data } = await s.download(id(q), q.auth!.userId);
  if (!['application/pdf', 'image/jpeg', 'image/png', 'text/plain'].includes(row.mimeType))
    throw new AppError(415, 'This document cannot be previewed safely.', 'PREVIEW_UNSUPPORTED');
  r.setHeader('content-type', row.mimeType);
  r.setHeader('content-disposition', `inline; filename="${encodeURIComponent(row.originalName)}"`);
  r.send(data);
});
export const remove = asyncHandler(async (q, r) => {
  await s.remove(id(q), q.auth!.userId);
  r.status(204).send();
});
export const forPatient = asyncHandler(async (q, r) => r.json({ data: await s.forPatient(id(q)) }));
export const list = asyncHandler(async (q, r) => r.json(await s.list(q.query)));
