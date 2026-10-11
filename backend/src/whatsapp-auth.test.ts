import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {openWhatsApp,sealWhatsApp,whatsappEncryptionKey} from './modules/whatsapp-auth';

test('WhatsApp credentials round-trip without plaintext and are bound to a farm/session/key',()=>{
 const key=randomBytes(32),context=JSON.stringify(['farm-a','generation-a','creds','creds']),secret='private authentication state';
 const encoded=sealWhatsApp(secret,key,context);
 assert.equal(encoded.includes(secret),false);assert.equal(openWhatsApp(encoded,key,context),secret);
 assert.notEqual(encoded,sealWhatsApp(secret,key,context));
 for(const other of [['farm-b','generation-a','creds','creds'],['farm-a','generation-b','creds','creds'],['farm-a','generation-a','session','creds']])assert.throws(()=>openWhatsApp(encoded,key,JSON.stringify(other)));
 assert.throws(()=>openWhatsApp(encoded,randomBytes(32),context));
 const parts=encoded.split('.');const data=Buffer.from(parts[3],'base64');data[0]^=1;parts[3]=data.toString('base64');assert.throws(()=>openWhatsApp(parts.join('.'),key,context));
});
test('WhatsApp encryption requires a 32-byte configured key',()=>{
 assert.throws(()=>whatsappEncryptionKey(''));assert.throws(()=>whatsappEncryptionKey('short'));
 const key=randomBytes(32);assert.deepEqual(whatsappEncryptionKey(key.toString('base64')),key);
});
