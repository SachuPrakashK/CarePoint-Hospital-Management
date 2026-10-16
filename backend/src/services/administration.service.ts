import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';

const audit = (userId: string, action: string, entityType: string, entityId: string | null, metadata?: Prisma.InputJsonValue) =>
  prisma.auditLog.create({ data: { userId, action, module: 'Administration', entityType, entityId, ...(metadata ? { metadata } : {}) } });

export const administrationService = {
  permissions: () => prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] }),
  async roles(q: { page: number; page_size: number; search?: string; status?: string; sort_by?:string; sort_order?:'asc'|'desc' }) {
    const where: Prisma.RoleWhereInput = {
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { code: { contains: q.search, mode: 'insensitive' } }] } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const direction=q.sort_order==='asc'?'asc':'desc'; const sorts:Record<string,Prisma.RoleOrderByWithRelationInput>={name:{name:direction},description:{description:direction},users:{users:{_count:direction}},status:{status:direction},createdAt:{createdAt:direction}};
    const [data,total]=await Promise.all([
      prisma.role.findMany({ where, skip:(q.page-1)*q.page_size, take:q.page_size, orderBy:[sorts[q.sort_by??'']??{createdAt:'desc'},{id:'asc'}], include:{ _count:{select:{users:true}}, permissions:{include:{permission:true}} } }),
      prisma.role.count({where}),
    ]);
    return { data, pagination:{page:q.page,page_size:q.page_size,total,total_pages:Math.ceil(total/q.page_size)} };
  },
  async role(id: string) {const role=await prisma.role.findUnique({ where:{id}, include:{permissions:{include:{permission:true}},_count:{select:{users:true}}} });if(!role)throw new AppError(404,'Role not found.','NOT_FOUND');return role;},
  async createRole(input: {name:string;description?:string;status:string;permissionCodes:string[]}, actor:string) {
    const code=input.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'');
    if (!code) throw new AppError(422,'Enter a valid role name.','VALIDATION_ERROR');
    const permissionCodes=[...new Set(input.permissionCodes)];
    const permissions=await prisma.permission.findMany({where:{code:{in:permissionCodes}}});
    if(permissions.length!==permissionCodes.length) throw new AppError(422,'One or more permissions are invalid.','VALIDATION_ERROR');
    const role=await prisma.role.create({data:{code,name:input.name,description:input.description,status:input.status,isSystem:false,permissions:{create:permissions.map(p=>({permissionId:p.id}))}},include:{permissions:{include:{permission:true}},_count:{select:{users:true}}}});
    await audit(actor,'ROLE_CREATED','Role',role.id,{code:role.code,permissionCodes}); return role;
  },
  async updateRole(id:string,input:{name?:string;description?:string;status?:string;permissionCodes?:string[]},actor:string){
    const current=await prisma.role.findUnique({where:{id},include:{permissions:{include:{permission:true}}}}); if(!current)throw new AppError(404,'Role not found.','NOT_FOUND');
    if(current.isSystem) throw new AppError(409,'System roles cannot be edited.','SYSTEM_ROLE_PROTECTED');
    const permissionCodes=input.permissionCodes ? [...new Set(input.permissionCodes)] : undefined;
    const permissions=permissionCodes ? await prisma.permission.findMany({where:{code:{in:permissionCodes}}}) : [];
    if(permissionCodes&&permissions.length!==permissionCodes.length)throw new AppError(422,'One or more permissions are invalid.','VALIDATION_ERROR');
    const role=await prisma.$transaction(async tx=>{ if(permissionCodes){await tx.rolePermission.deleteMany({where:{roleId:id}});await tx.rolePermission.createMany({data:permissions.map(p=>({roleId:id,permissionId:p.id}))});} return tx.role.update({where:{id},data:{name:input.name,description:input.description,status:input.status},include:{permissions:{include:{permission:true}},_count:{select:{users:true}}}}); });
    const before=new Set(current.permissions.map(value=>value.permission.code));const after=new Set(role.permissions.map(value=>value.permission.code));const permissionsAdded=[...after].filter(code=>!before.has(code));const permissionsRemoved=[...before].filter(code=>!after.has(code));
    await audit(actor,'ROLE_UPDATED','Role',id,{permissionCount:role.permissions.length,permissionsAdded,permissionsRemoved}); return role;
  },
  async deleteRole(id:string,actor:string){const role=await prisma.role.findUnique({where:{id},include:{_count:{select:{users:true}}}});if(!role)throw new AppError(404,'Role not found.','NOT_FOUND');if(role.isSystem)throw new AppError(409,'System roles cannot be deleted.','SYSTEM_ROLE_PROTECTED');if(role._count.users)throw new AppError(409,'Reassign users before deleting this role.','ROLE_IN_USE');await prisma.role.delete({where:{id}});await audit(actor,'ROLE_DELETED','Role',id,{code:role.code});},
  hospital:()=>prisma.hospitalSettings.upsert({where:{id:'default'},update:{},create:{id:'default'}}),
  application:()=>prisma.applicationSettings.upsert({where:{id:'default'},update:{},create:{id:'default'}}),
  notifications:()=>prisma.notificationSettings.upsert({where:{id:'default'},update:{},create:{id:'default'}}),
  security:()=>prisma.securitySettings.upsert({where:{id:'default'},update:{},create:{id:'default'}}),
  async updateSettings(section:'hospital'|'application'|'notifications'|'security',data:any,actor:string){const models={hospital:prisma.hospitalSettings,application:prisma.applicationSettings,notifications:prisma.notificationSettings,security:prisma.securitySettings} as const;const result=await (models[section] as any).upsert({where:{id:'default'},update:data,create:{id:'default',...data}});await audit(actor,'SETTINGS_UPDATED','Settings',section,{section});return result;},
};

export const validatePasswordAgainstPolicy=async(password:string)=>{const policy=await administrationService.security();const errors=[] as string[];if(password.length<policy.passwordMinimumLength)errors.push(`Use at least ${policy.passwordMinimumLength} characters.`);if(policy.requireUppercase&&!/[A-Z]/.test(password))errors.push('Include an uppercase letter.');if(policy.requireLowercase&&!/[a-z]/.test(password))errors.push('Include a lowercase letter.');if(policy.requireNumber&&!/\d/.test(password))errors.push('Include a number.');if(policy.requireSpecial&&!/[^A-Za-z0-9]/.test(password))errors.push('Include a special character.');if(errors.length)throw new AppError(422,'Password does not meet the security policy.','PASSWORD_POLICY',{password:errors});return policy;};
