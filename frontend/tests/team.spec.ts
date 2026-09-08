import {test,expect} from '@playwright/test';

test('team editing, ownership protection and viewer notifications',async({page,playwright,browser,baseURL})=>{
 const origin=new URL(baseURL!).origin;
 const owner=page.request;
 const viewer=await playwright.request.newContext({baseURL,extraHTTPHeaders:{Origin:origin}});
 const outsider=await playwright.request.newContext({baseURL,extraHTTPHeaders:{Origin:origin}});
 const suffix=Date.now();
 const password='Team-test-12345';
 const post=(url:string,data:unknown)=>owner.post(url,{headers:{Origin:origin},data});
 try{
  const registration=await post('/api/v1/auth/register',{name:'Team owner',email:`team-owner-${suffix}@example.invalid`,password});
  expect(registration.status()).toBe(201);
  const ownerId=(await registration.json()).id;
  const email=`team-viewer-${suffix}@example.invalid`;
  const member=await viewer.post('/api/v1/auth/register',{data:{name:'Team viewer',email,password}});
  expect(member.status()).toBe(201);
  const memberId=(await member.json()).id;
  expect((await outsider.post('/api/v1/auth/register',{data:{name:'Other owner',email:`team-other-${suffix}@example.invalid`,password}})).status()).toBe(201);
  const farmResponse=await post('/api/v1/farms',{name:'Team test farm',city:'Lahore',currency:'PKR'});
  expect(farmResponse.status()).toBe(201);
  const farm=(await farmResponse.json()).id;
  const base=`/api/v1/farms/${farm}`;
  const otherFarm=await outsider.post('/api/v1/farms',{data:{name:'Other team farm',city:'Lahore',currency:'PKR'}});
  const otherBase=`/api/v1/farms/${(await otherFarm.json()).id}`;
  const foreignRole=await outsider.post(otherBase+'/roles',{data:{name:'Foreign role',permissions:[]}});
  expect(foreignRole.status()).toBe(201);
  expect((await post(base+'/team',{email,role:'VIEWER',roleId:(await foreignRole.json()).id})).status()).toBe(400);
  expect((await post(base+'/roles',{name:'Invalid role',permissions:[{module:'unknown',access:'write'}]})).status()).toBe(400);
  const role=await post(base+'/roles',{name:'Farm reader',permissions:[{module:'animals',access:'read'}]});
  expect(role.status()).toBe(201);
  expect((await post(base+'/roles',{name:'Farm reader',permissions:[]})).status()).toBe(409);
  expect((await post(base+'/team',{email,role:'OWNER',roleId:(await role.json()).id})).status()).toBe(400);
  expect((await post(base+'/team',{email,role:'VIEWER'})).status()).toBe(201);
  expect((await post(base+'/team',{email,role:'VIEWER'})).status()).toBe(409);
  expect((await viewer.put(base+'/team/'+ownerId,{data:{role:'VIEWER'}})).status()).toBe(403);
  expect((await owner.delete(base+'/team/'+ownerId,{headers:{Origin:origin}})).status()).toBe(409);
  expect((await owner.put(base+'/team/'+ownerId,{headers:{Origin:origin},data:{role:'VIEWER'}})).status()).toBe(409);
  const notifications=await (await viewer.get(base+'/notifications')).json();
  expect(notifications.unread).toBe(1);
  expect((await post(base+'/notifications/'+notifications.rows[0].id+'/read',{})).status()).toBe(404);
  const viewerContext=await browser.newContext({baseURL,storageState:await viewer.storageState()});
  try{
   const viewerPage=await viewerContext.newPage();
   await viewerPage.goto('/dashboard?farm='+farm);
   await expect(viewerPage.locator('.bell-badge')).toHaveText('1');
   await viewerPage.getByRole('button',{name:'Notifications',exact:true}).click();
   await viewerPage.getByRole('button',{name:/You were added to Team test farm/}).click();
   await expect.poll(async()=>(await (await viewer.get(base+'/notifications')).json()).unread).toBe(0);
   expect((await owner.delete(base+'/team/'+memberId,{headers:{Origin:origin}})).status()).toBe(200);
   expect((await post(base+'/team',{email,role:'VIEWER'})).status()).toBe(201);
   await viewerPage.reload();
   await viewerPage.getByRole('button',{name:'Notifications',exact:true}).click();
   await viewerPage.getByRole('button',{name:'Mark all read',exact:true}).click();
   await expect(viewerPage.locator('.bell-badge')).toHaveCount(0);
   expect((await (await viewer.get(base+'/notifications')).json()).unread).toBe(0);
  }finally{await viewerContext.close()}
  expect((await viewer.post(base+'/notifications/'+notifications.rows[0].id+'/read')).status()).toBe(200);
  expect((await (await viewer.get(base+'/notifications')).json()).unread).toBe(0);
  expect((await viewer.post(base+'/notifications/read-all')).status()).toBe(200);
  expect((await viewer.put(base+'/settings',{data:{notes:'Denied'}})).status()).toBe(403);

  await page.goto('/dashboard?farm='+farm);
  await page.getByRole('button',{name:'User menu',exact:true}).click();
  await page.locator('.user-menu-pop').getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Team',exact:true}).click();
  const row=page.getByRole('row').filter({hasText:email});
  await row.getByRole('button',{name:'Edit',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Edit member',exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option',{name:'Owner',exact:true}).click();
  await page.getByRole('button',{name:'Save member',exact:true}).click();
  await expect.poll(async()=>((await (await owner.get(base+'/team')).json()) as {id:string;role:string}[]).find(r=>r.id===memberId)?.role).toBe('OWNER');
  // Both owners try to demote themselves concurrently; exactly one must remain.
  const changes=await Promise.all([
   owner.put(base+'/team/'+ownerId,{headers:{Origin:origin},data:{role:'VIEWER'}}),
   viewer.put(base+'/team/'+memberId,{data:{role:'VIEWER'}})
  ]);
  expect(changes.map(r=>r.status()).sort()).toEqual([200,409]);
  const team=await (await owner.get(base+'/team')).json();
  const remaining=team.find((r:{role:string})=>r.role==='OWNER');
  const admin=remaining.id===ownerId?owner:viewer;
  const removedId=remaining.id===ownerId?memberId:ownerId;
  expect((await admin.delete(base+'/team/'+removedId,{headers:{Origin:origin}})).status()).toBe(200);
  const removed=removedId===ownerId?owner:viewer;
  expect((await removed.get(base+'/records/animals')).status()).toBe(404);
  expect((await removed.get(base+'/team')).status()).toBe(404);
  expect((await outsider.get(base+'/team')).status()).toBe(404);
 }finally{await viewer.dispose();await outsider.dispose()}
});
