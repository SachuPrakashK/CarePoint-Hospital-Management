import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const env=Object.fromEntries(fs.readFileSync('backend/.env','utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#')&&x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const api='http://localhost:3000/api/v1';
const call=async(path,options={})=>{const response=await fetch(`${api}${path}`,{...options,headers:{'content-type':'application/json',...options.headers}});return{response,body:await response.json().catch(()=>null)}};
const authenticate=async()=>{for(let attempt=0;attempt<7;attempt++){const response=await call('/auth/login',{method:'POST',body:JSON.stringify({email:env.SEED_HOSPITAL_ADMIN_EMAIL,password:env.SEED_HOSPITAL_ADMIN_PASSWORD})});if(response.response.status===200)return response.body.data;if(response.response.status!==429)assert.equal(response.response.status,200);await new Promise(resolve=>setTimeout(resolve,5000))}throw new Error('Authentication remained rate limited.');};
const sessionFor=data=>{const user=data.user;return{user:{id:user.id,name:`${user.first_name} ${user.last_name}`.trim(),email:user.email,phone:user.phone??undefined,role:user.role,roles:user.roles,permissions:user.permissions},accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+data.expires_in*1000,remember:false}};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors=[];let roleId;let cleanupToken;
const openPage=async(session)=>{const page=await browser.newPage({viewport:{width:900,height:600}});page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});page.on('response',response=>{if(response.status()>=500)errors.push(`${response.status()} ${response.url()}`)});await page.addInitScript(value=>sessionStorage.setItem('carepoint.auth.tab-session',JSON.stringify(value)),session);await page.goto('http://localhost:4303/roles',{waitUntil:'networkidle'});return page};
const suffix=Date.now().toString(36);const roleName=`Independent Editor ${suffix}`;
try{
  const initialAuth=await authenticate();cleanupToken=initialAuth.access_token;let page=await openPage(sessionFor(initialAuth));
  await page.getByRole('button',{name:'+ Create Role'}).click();
  const create=page.getByRole('dialog',{name:'Create Role'});await create.waitFor();
  const permissions=create.getByRole('region',{name:'Role permissions'});const footer=create.locator('.crud-modal__footer');
  assert.equal(await permissions.evaluate(element=>getComputedStyle(element).overflowY),'auto');assert.ok(await permissions.evaluate(element=>element.scrollHeight>=element.clientHeight));
  assert.ok(await create.locator('.crud-modal__header').isVisible());assert.ok(await footer.isVisible());
  const patients=permissions.locator('fieldset').filter({hasText:'Patients'});const view=patients.getByRole('checkbox',{name:'View',exact:true});const edit=patients.getByRole('checkbox',{name:'Edit',exact:true});
  await edit.check();assert.equal(await edit.isChecked(),true);assert.equal(await view.isChecked(),false);
  await permissions.evaluate(element=>element.scrollTop=element.scrollHeight);assert.ok(await footer.isVisible());await permissions.evaluate(element=>element.scrollTop=0);assert.equal(await edit.isChecked(),true);
  await create.getByPlaceholder('Enter role name').fill(roleName);await create.getByPlaceholder("Describe this role's responsibilities").fill('Created with only Edit permission.');
  await create.getByRole('button',{name:'Create Role'}).click();await create.waitFor({state:'detached'});
  const search=page.getByRole('searchbox',{name:'Search'});await search.fill(roleName);await page.waitForTimeout(400);const row=page.getByRole('row').filter({hasText:roleName});await row.waitFor();
  await row.getByRole('button',{name:`Actions for ${roleName}`}).evaluate(element=>element.click());await page.getByRole('menuitem',{name:'Edit'}).evaluate(element=>element.click());
  const editor=page.getByRole('dialog',{name:'Edit Role'});await editor.waitFor();const editPatients=editor.getByRole('region',{name:'Role permissions'}).locator('fieldset').filter({hasText:'Patients'});
  assert.equal(await editPatients.getByRole('checkbox',{name:'Edit',exact:true}).isChecked(),true);assert.equal(await editPatients.getByRole('checkbox',{name:'View',exact:true}).isChecked(),false);
  await editPatients.getByRole('checkbox',{name:'Edit',exact:true}).uncheck();await editPatients.getByRole('checkbox',{name:'Delete',exact:true}).check();assert.equal(await editPatients.getByRole('checkbox',{name:'View',exact:true}).isChecked(),false);
  await editor.getByPlaceholder("Describe this role's responsibilities").fill('Updated with only Delete permission.');await editor.getByRole('button',{name:'Save Changes'}).click();await editor.waitFor({state:'detached'});
  const headers={authorization:`Bearer ${initialAuth.access_token}`};const persisted=(await call(`/roles?page_size=100&search=${encodeURIComponent(roleName)}`,{headers})).body.data[0];roleId=persisted.id;assert.deepEqual(persisted.permissions.map(value=>value.permission.code),['patients.delete']);
  const refreshedSession=JSON.parse(await page.evaluate(()=>sessionStorage.getItem('carepoint.auth.tab-session')));await page.close();page=await openPage(refreshedSession);const refreshedSearch=page.getByRole('searchbox',{name:'Search'});await refreshedSearch.fill(roleName);await page.waitForTimeout(400);const refreshedRow=page.getByRole('row').filter({hasText:roleName});await refreshedRow.waitFor();await refreshedRow.getByRole('button',{name:`Actions for ${roleName}`}).evaluate(element=>element.click());await page.getByRole('menuitem',{name:'Edit'}).evaluate(element=>element.click());const reopened=page.getByRole('dialog',{name:'Edit Role'});await reopened.waitFor();const reopenedPatients=reopened.getByRole('region',{name:'Role permissions'}).locator('fieldset').filter({hasText:'Patients'});assert.equal(await reopenedPatients.getByRole('checkbox',{name:'Delete',exact:true}).isChecked(),true);assert.equal(await reopenedPatients.getByRole('checkbox',{name:'Edit',exact:true}).isChecked(),false);assert.equal(await reopenedPatients.getByRole('checkbox',{name:'View',exact:true}).isChecked(),false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({smallViewportScroll:'passed',fixedHeaderFooter:'passed',independentCreate:'passed',editPreselection:'passed',exactUpdate:'passed',refreshPersistence:'passed',consoleErrors:0}));await page.close();
}finally{
  if(roleId&&cleanupToken)await call(`/roles/${roleId}`,{method:'DELETE',headers:{authorization:`Bearer ${cleanupToken}`}});await browser.close();
}
