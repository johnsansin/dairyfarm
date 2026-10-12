import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const requireBackend=createRequire(process.cwd()+'/../backend/package.json');const {Client}=requireBackend('pg');
test('superadmin can create, download and delete a full backup with visible feedback',async({page,baseURL})=>{
 if(!process.env.BACKUP_TEST_DATABASE_URL)throw Error('Explicit disposable BACKUP_TEST_DATABASE_URL required');
 const registration=await page.request.post('/api/v1/auth/register',{headers:{Origin:new URL(baseURL!).origin},data:{name:'Backup Browser Admin',email:`backup-ui-${Date.now()}@example.invalid`,password:'backup-browser-123'}});expect(registration.status()).toBe(201);const user=await registration.json();const db=new Client({connectionString:process.env.BACKUP_TEST_DATABASE_URL});await db.connect();try{await db.query('UPDATE users SET is_superadmin=true WHERE id=$1',[user.id])}finally{await db.end()}
 await page.goto('/superadmin');await page.getByRole('button',{name:'Settings',exact:true}).click();const panel=page.getByRole('region',{name:'Platform backups'});await panel.getByRole('button',{name:'Back up now',exact:true}).click();await expect(panel.getByText('Backup ready. Download or delete it below.')).toBeVisible({timeout:30000});const row=panel.locator('tbody tr').first();await expect(row.getByRole('button',{name:'Delete',exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await row.getByRole('button',{name:'Download',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/\.tar\.gz$/);
 page.once('dialog',dialog=>dialog.dismiss());await row.getByRole('button',{name:'Delete',exact:true}).click();await expect(row).toBeVisible();page.once('dialog',dialog=>dialog.accept());await row.getByRole('button',{name:'Delete',exact:true}).click();await expect(panel.getByText('Backup deleted.',{exact:true})).toBeVisible();await expect(panel.locator('tbody tr')).toHaveCount(0);
});
