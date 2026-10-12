import {test,expect} from '@playwright/test';

// The UI uses deterministic transport responses; verify-whatsapp.ts tests persistence,
// authorization and a separate opt-in real Baileys QR handshake.
test('farm settings display QR pairing, expiry, linked number and unlink with farm isolation',async({page,baseURL})=>{
 const headers={Origin:new URL(baseURL!).origin},errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 expect((await page.request.post('/api/v1/auth/register',{headers,data:{name:'WhatsApp UI Owner',email:`wa-ui-${Date.now()}@example.invalid`,password:'WhatsApp-test-123'}})).status()).toBe(201);
 const createFarm=async(name:string)=>(await (await page.request.post('/api/v1/farms',{headers,data:{name,city:'Lahore',currency:'PKR'}})).json()).id;
 const farmA=await createFarm('WhatsApp Farm A'),farmB=await createFarm('WhatsApp Farm B');
 const empty={configured:true,status:'disconnected',phone_number:null,account_name:null,last_error:null,linked_at:null,qr_data_url:null,qr_expires_at:null};
 let state:any={...empty},connects=0,disconnects=0;
 const qr='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
 await page.route(/\/settings\/whatsapp(?:\/(?:connect|disconnect))?$/,async route=>{
  if(route.request().url().includes(farmB)){await route.fulfill({json:empty});return}
  if(route.request().url().endsWith('/connect')){connects++;state={...empty,status:'qr',qr_data_url:qr,qr_expires_at:new Date(Date.now()+55000).toISOString()}}
  if(route.request().url().endsWith('/disconnect')){disconnects++;state={...empty,remote_logout:true}}
  await route.fulfill({status:route.request().url().endsWith('/connect')?202:200,json:state});
 });
 await page.goto('/dashboard?farm='+farmA+'&tab=settings');await page.getByRole('button',{name:'WhatsApp',exact:true}).click();
 await expect(page.getByText('Not linked',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Link WhatsApp',exact:true}).click();
 await expect(page.getByRole('img',{name:'Scan this QR code with WhatsApp to link this farm'})).toBeVisible();expect(connects).toBe(1);
 state={...state,qr_expires_at:new Date(Date.now()-1000).toISOString()};await page.getByRole('button',{name:'Refresh status'}).click();await expect(page.getByRole('img')).toHaveCount(0);await expect(page.getByText('Waiting for a fresh QR code…')).toBeVisible();
 state={...empty,status:'connected',phone_number:'+923001234567',account_name:'Farm A owner',linked_at:new Date().toISOString()};await page.getByRole('button',{name:'Refresh status'}).click();await expect(page.getByText('+923001234567',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Link WhatsApp',exact:true})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/whatsapp-mobile.png',fullPage:true});
 await page.goto('/dashboard?farm='+farmB+'&tab=settings');await page.getByRole('button',{name:'WhatsApp',exact:true}).click();await expect(page.getByText('Not linked',{exact:true})).toBeVisible();await expect(page.getByText('+923001234567',{exact:true})).toHaveCount(0);
 await page.goto('/dashboard?farm='+farmA+'&tab=settings');await page.getByRole('button',{name:'WhatsApp',exact:true}).click();await expect(page.getByText('+923001234567',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Unlink WhatsApp',exact:true}).click();await expect(page.getByText('Not linked',{exact:true})).toBeVisible();expect(disconnects).toBe(1);
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/whatsapp-desktop.png',fullPage:true});expect(errors).toEqual([]);
});
