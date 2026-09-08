import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registration,login,farmInput} from './validation';
test('registration rejects passwords below minimum and normalizes email',()=>{
 assert.equal(registration.safeParse({name:'Ali',email:'ali@example.com',password:'short'}).success,false);
 assert.equal(registration.parse({name:'Ali',email:'ALI@example.com',password:'long-password-123'}).email,'ali@example.com');
});
test('multibyte passwords cannot exceed bcrypt byte limit',()=>{
 assert.equal(registration.safeParse({name:'Ali',email:'ali@example.com',password:'پ'.repeat(40)}).success,false);
});
test('farm input rejects blank names and unsupported currencies',()=>{
 assert.equal(farmInput.safeParse({name:'  ',city:'Lahore',currency:'PKR'}).success,false);
 assert.equal(farmInput.safeParse({name:'Al Noor',city:'Lahore',currency:'XYZ'}).success,false);
});

test('registration and login accept six characters and reject five',()=>{
 for(const schema of [registration,login]){
  assert.equal(schema.safeParse({name:'Ali',email:'ali@example.com',password:'abc123'}).success,true);
  assert.equal(schema.safeParse({name:'Ali',email:'ali@example.com',password:'abc12'}).success,false);
 }
});
