import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
const db=prisma as any;
export const languageService={
  listEnabled:()=>db.language.findMany({where:{enabled:true,translationCoverage:{gte:100}},orderBy:[{isDefault:'desc'},{name:'asc'}]}),
  listAll:()=>db.language.findMany({orderBy:[{isDefault:'desc'},{name:'asc'}]}),
  preference:async(userId:string)=>{const value=await db.userLanguagePreference.findUnique({where:{userId},include:{language:true}});return value?.language?.enabled&&value.language.translationCoverage>=100?value.language:null;},
  async select(userId:string,code:string){const language=await db.language.findUnique({where:{code}});if(!language||!language.enabled||language.translationCoverage<100)throw new AppError(422,'This language is not enabled with complete translations.','LANGUAGE_UNAVAILABLE');await db.userLanguagePreference.upsert({where:{userId},update:{languageId:language.id},create:{userId,languageId:language.id}});return language;},
  async update(code:string,enabled:boolean){if(code==='en'&&!enabled)throw new AppError(409,'English is the required fallback language.','DEFAULT_LANGUAGE_REQUIRED');const language=await db.language.findUnique({where:{code}});if(!language)throw new AppError(404,'Language pack not found.','NOT_FOUND');if(enabled&&language.translationCoverage<100)throw new AppError(422,'This translation pack is incomplete and cannot be enabled.','TRANSLATION_INCOMPLETE');return db.language.update({where:{code},data:{enabled}});},
};
