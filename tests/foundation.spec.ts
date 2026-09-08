import {test,expect} from '@playwright/test';
test('public website, Urdu RTL, mobile layout and links',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{level:1})).toContainText('Better insight');
 await page.getByRole('button',{name:'اردو',exact:true}).first().click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.getByRole('heading',{level:1})).toContainText('بہتر معلومات');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','ur');
 await page.getByRole('button',{name:'English',exact:true}).first().click();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 await page.screenshot({path:'test-results/mobile-home.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/desktop-home.png',fullPage:true});
 await page.getByRole('link',{name:'Get started',exact:true}).click();await expect(page).toHaveURL(/register/);
});
test('registration, farm creation, login, logout and tenant isolation',async({page,playwright,baseURL})=>{
 const email=`owner-${Date.now()}@example.invalid`;const password='Test-password-12345';
 await page.goto('/register');await page.getByLabel('Full name').fill('Test Farm Owner');await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page).toHaveURL(/dashboard/);
 await page.getByLabel('Farm name',{exact:true}).fill('Integration Farm');await page.getByLabel('City / location').fill('Lahore');await page.getByRole('button',{name:'Create farm',exact:true}).click();await expect(page.getByRole('combobox',{name:'Active farm'})).toContainText('Integration Farm · Lahore');
 const farms=await (await page.request.get('/api/v1/farms')).json();expect(farms).toHaveLength(1);
 const other=await playwright.request.newContext({baseURL,extraHTTPHeaders:{Origin:new URL(baseURL!).origin}});
 const registration=await other.post('/api/v1/auth/register',{data:{name:'Other Owner',email:`other-${Date.now()}@example.invalid`,password}});expect(registration.status()).toBe(201);
 expect(await (await other.get('/api/v1/farms')).json()).toEqual([]);
 expect((await other.get(`/api/v1/farms/${farms[0].id}`)).status()).toBe(404);
 expect((await other.post('/api/v1/farms',{headers:{Origin:'https://untrusted.invalid'},data:{name:'Bad farm',city:'Lahore',currency:'PKR'}})).status()).toBe(403);
 await other.dispose();
 await page.getByRole('button',{name:'User menu',exact:true}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/signin/);
 expect((await page.request.get('/api/v1/farms')).status()).toBe(401);
 await page.getByLabel('Email address').fill(email);await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/dashboard/);await expect(page.getByRole('combobox',{name:'Active farm'})).toContainText('Integration Farm · Lahore');
});
