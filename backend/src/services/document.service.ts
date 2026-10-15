import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { documentRepository as repo } from '../repositories/document.repository.js';
import { fileStorage } from './file-storage.service.js';
import { AppError } from '../utils/app-error.js';
import { prisma } from '../config/prisma.js';
const allowed = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['text/plain', '.txt'],
]);
const validSignature=(type:string,b:Buffer)=>type==='application/pdf'?b.subarray(0,5).toString()==='%PDF-':type==='image/jpeg'?b[0]===255&&b[1]===216:type==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='text/plain'?!b.subarray(0,1024).includes(0):false;
const publicView = (x: any) => ({
  id: x.id,
  patientId: x.patientId,
  ownerType: x.ownerType,
  ownerId: x.ownerId,
  originalName: x.originalName,
  mimeType: x.mimeType,
  size: x.size,
  sensitive: x.sensitive,
  uploadedById: x.uploadedById,
  createdAt: x.createdAt,
});
export const documentService = {
  async upload(file: Express.Multer.File, input: any, actorId: string) {
    const expected = allowed.get(file.mimetype);
    if (
      !expected || !validSignature(file.mimetype,file.buffer) ||
      !['.jpg', '.jpeg', expected].includes(extname(file.originalname).toLowerCase())
    )
      throw new AppError(422, 'File type and extension are not allowed.', 'INVALID_FILE');
    if (input.ownerType === 'Patient' && !await prisma.patient.findFirst({ where: { id: input.ownerId, deletedAt: null } }))
      throw new AppError(422, 'Select a valid patient.', 'INVALID_OWNER');
    const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}${expected}`;
    await fileStorage.put(key, file.buffer);
    try {
      const row = await repo.create({
        patientId: input.ownerType === 'Patient' ? input.ownerId : input.patientId || null,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        storageKey: key,
        originalName: file.originalname.replace(/[^\w. -]/g, '_').slice(0, 255),
        mimeType: file.mimetype,
        size: file.size,
        sensitive: input.sensitive !== 'false',
        uploadedById: actorId,
      });
      await prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'UPLOAD',
          module: 'documents',
          entityType: 'Document',
          entityId: row.id,
        },
      });
      return publicView(row);
    } catch (e) {
      await fileStorage.remove(key);
      throw e;
    }
  },
  async details(id: string) {
    const row = await repo.find(id);
    if (!row) throw new AppError(404, 'Document was not found.', 'NOT_FOUND');
    return publicView(row);
  },
  async list(q:any){const where:any={...(q.search?{originalName:{contains:q.search,mode:'insensitive'}}:{}),...(q.owner_type?{ownerType:q.owner_type}:{}),...(q.mime_type?{mimeType:q.mime_type}:{}),...(q.created_from||q.created_to?{createdAt:{...(q.created_from?{gte:new Date(`${q.created_from}T00:00:00.000Z`)}:{}),...(q.created_to?{lte:new Date(`${q.created_to}T23:59:59.999Z`)}:{})}}:{})};const direction=q.sort_order==='asc'?'asc':'desc';const sorts:any={originalName:{originalName:direction},ownerType:{ownerType:direction},mimeType:{mimeType:direction},size:{size:direction},uploadedBy:{uploadedBy:{firstName:direction}},createdAt:{createdAt:direction}};const [data,total]=await Promise.all([repo.list(where,(q.page-1)*q.page_size,q.page_size,[sorts[q.sort_by]??{createdAt:'desc'},{id:'asc'}]),repo.count(where)]);return{data:data.map((x:any)=>({...publicView(x),uploadedByName:`${x.uploadedBy.firstName} ${x.uploadedBy.lastName}`})),pagination:{page:q.page,page_size:q.page_size,total,total_pages:Math.ceil(total/q.page_size)}};},
  async download(id: string, actorId: string) {
    const row = await repo.find(id);
    if (!row) throw new AppError(404, 'Document was not found.', 'NOT_FOUND');
    await prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'DOWNLOAD',
        module: 'documents',
        entityType: 'Document',
        entityId: id,
      },
    });
    return { row, data: await fileStorage.get(row.storageKey) };
  },
  async remove(id: string, actorId: string) {
    const row = await repo.find(id);
    if (!row) throw new AppError(404, 'Document was not found.', 'NOT_FOUND');
    await repo.archive(id);
    // Retain the encrypted/storage object for clinical and legal history; the record is soft deleted.
    await prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'DELETE',
        module: 'documents',
        entityType: 'Document',
        entityId: id,
      },
    });
  },
  async forPatient(id: string) {
    return (await repo.forPatient(id)).map(publicView);
  },
};
