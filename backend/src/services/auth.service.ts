import { createHash, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AppError } from '../utils/app-error.js';
import { notificationProvider } from './notification-provider.js';
import { prisma } from '../config/prisma.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const permissionsFor = (user: Awaited<ReturnType<typeof authRepository.findUserByEmail>>) =>
  [...new Set(user?.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)) ?? [])];

export const authService = {
  async login(email: string, password: string, context: { userAgent?: string; ipAddress?: string }) {
    const user = await authRepository.findUserByEmail(email);
    if (!user || user.status !== 'ACTIVE' || !(await argon2.verify(user.passwordHash, password))) {
      throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
    }
    const sessionId = randomUUID();
    const permissions = permissionsFor(user);
    const refreshToken = jwt.sign({ sub: user.id, sid: sessionId, type: 'refresh' }, env.REFRESH_TOKEN_SECRET, { expiresIn: `${env.REFRESH_TOKEN_EXPIRATION_DAYS}d` });
    await authRepository.createSession({
      id: sessionId, userId: user.id, tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRATION_DAYS * 86_400_000), ...context,
    });
    await authRepository.touchLogin(user.id);
    const accessToken = jwt.sign({ sub: user.id, sid: sessionId, permissions }, env.ACCESS_TOKEN_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRATION as SignOptions['expiresIn'] });
    return { access_token: accessToken, refresh_token: refreshToken, expires_in: 900, user: { id: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName, role: user.roles[0]?.role.code ?? 'HOSPITAL_ADMIN', permissions } };
  },
  async logout(sessionId: string) { await authRepository.revokeSession(sessionId); },
  async refresh(rawToken: string, context: { userAgent?: string; ipAddress?: string }) {
    let claims: { sub: string; sid: string; type: string };
    try { claims = jwt.verify(rawToken, env.REFRESH_TOKEN_SECRET) as typeof claims; } catch { throw new AppError(401, 'The refresh token is invalid or expired.', 'INVALID_REFRESH_TOKEN'); }
    const session=await authRepository.findSession(claims.sid);
    if(!session||session.revokedAt||session.expiresAt<=new Date()||session.tokenHash!==hashToken(rawToken)){if(session)await authRepository.revokeAllSessions(session.userId);throw new AppError(401,'The refresh session is no longer valid.','INVALID_REFRESH_TOKEN');}
    await authRepository.revokeSession(session.id);
    const user=await authRepository.findUserById(session.userId); if(!user||user.status!=='ACTIVE')throw new AppError(401,'The account is unavailable.','UNAUTHORIZED');
    const sid=randomUUID(),permissions=permissionsFor(user),refreshToken=jwt.sign({sub:user.id,sid,type:'refresh'},env.REFRESH_TOKEN_SECRET,{expiresIn:`${env.REFRESH_TOKEN_EXPIRATION_DAYS}d`});
    await authRepository.createSession({id:sid,userId:user.id,tokenHash:hashToken(refreshToken),expiresAt:new Date(Date.now()+env.REFRESH_TOKEN_EXPIRATION_DAYS*86_400_000),...context});
    return {access_token:jwt.sign({sub:user.id,sid,permissions},env.ACCESS_TOKEN_SECRET,{expiresIn:env.ACCESS_TOKEN_EXPIRATION as SignOptions['expiresIn']}),refresh_token:refreshToken,expires_in:900};
  },
  async changePassword(userId:string,current:string,next:string){const user=await authRepository.findUserById(userId);if(!user||!(await argon2.verify(user.passwordHash,current)))throw new AppError(422,'Validation failed.','VALIDATION_ERROR',{current_password:['Current password is incorrect.']});await authRepository.updatePassword(userId,await argon2.hash(next));await authRepository.revokeAllSessions(userId);},
  async forgotPassword(email:string){const user=await authRepository.findUserByEmail(email);if(!user||user.status!=='ACTIVE')return;await authRepository.invalidatePasswordResets(user.id);const token=randomUUID()+randomUUID();await authRepository.createPasswordReset({userId:user.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+30*60_000)});await notificationProvider.sendPasswordReset(user.email,`${env.FRONTEND_RESET_URL}?token=${encodeURIComponent(token)}`);},
  async resetPassword(token:string,password:string){const record=await authRepository.findPasswordReset(hashToken(token));if(!record||record.usedAt||record.expiresAt<=new Date())throw new AppError(422,'Validation failed.','VALIDATION_ERROR',{token:['The password reset link is invalid or expired.']});await prisma.$transaction(async tx=>{await tx.user.update({where:{id:record.userId},data:{passwordHash:await argon2.hash(password)}});await tx.passwordResetToken.update({where:{id:record.id},data:{usedAt:new Date()}});await tx.refreshSession.updateMany({where:{userId:record.userId,revokedAt:null},data:{revokedAt:new Date()}});});},
  async register(input:{first_name:string;last_name:string;email:string;phone?:string;password:string}){const email=input.email.trim().toLowerCase();if(await authRepository.findUserByEmail(email))throw new AppError(409,'An account with this email already exists.','EMAIL_EXISTS',{email:['Email is already registered.']});const passwordHash=await argon2.hash(input.password);return prisma.$transaction(async tx=>{const role=await tx.role.upsert({where:{code:'PATIENT'},update:{},create:{code:'PATIENT',name:'Patient',description:'Self-service patient account'}});const user=await tx.user.create({data:{email,firstName:input.first_name.trim(),lastName:input.last_name.trim(),phone:input.phone?.trim()||null,passwordHash,roles:{create:{roleId:role.id}}},select:{id:true,email:true,firstName:true,lastName:true,phone:true}});return{id:user.id,email:user.email,first_name:user.firstName,last_name:user.lastName,phone:user.phone};});},
};
