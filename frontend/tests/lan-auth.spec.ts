import {test,expect} from '@playwright/test';
test('LAN signup and login accept six-character passwords',async({page})=>{
 const email=`lan-six-${Date.now()}@example.invalid`;
 await page.goto('/register');
 await expect(page.getByText('Use at least 6 characters.',{exact:true})).toBeVisible();
 await expect(page.locator('input[name=password]')).toHaveAttribute('minlength','6');
 await page.getByLabel('Full name').fill('LAN verification');
 await page.getByLabel('Email address').fill(email);
 await page.getByLabel('Password',{exact:true}).fill('six123');
 await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page).toHaveURL(/\/dashboard$/);
 await expect(page.getByRole('heading',{name:'Add dairy farm',exact:true})).toBeVisible();
 await page.goto('/');
 await expect(page.locator('header').getByRole('link',{name:'LAN verification',exact:true})).toBeVisible();
 await expect(page.locator('header').getByRole('link',{name:'Sign in',exact:true})).toHaveCount(0);
 await page.reload();
 await expect(page.locator('header').getByRole('link',{name:'LAN verification',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('header').getByRole('link',{name:'LAN verification',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.locator('header').getByRole('link',{name:'LAN verification',exact:true}).click();
 await expect(page).toHaveURL(/\/dashboard$/);

 await page.getByRole('button',{name:'User menu',exact:true}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page).toHaveURL(/\/signin$/);
 await page.goto('/');
 await page.setViewportSize({width:1280,height:900});
 await expect(page.locator('header').getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
 await page.locator('header').getByRole('link',{name:'Sign in',exact:true}).click();

 await expect(page.getByText('Use at least 6 characters.',{exact:true})).toBeVisible();
 await expect(page.locator('input[name=password]')).toHaveAttribute('minlength','6');
 await page.getByLabel('Email address').fill(email);
 await page.getByLabel('Password',{exact:true}).fill('six123');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/dashboard$/);
});
