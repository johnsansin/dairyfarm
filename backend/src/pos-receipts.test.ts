import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWhatsApp,receiptMessage} from './modules/pos-receipts';
test('customer WhatsApp numbers normalize local Pakistan and international formats',()=>{
 for(const number of ['0300 1234567','+92 (300) 123-4567','00923001234567','923001234567'])assert.equal(normalizeWhatsApp(number),'+923001234567');
 assert.equal(normalizeWhatsApp(''),'');assert.equal(normalizeWhatsApp('+1 (202) 555-0123'),'+12025550123');
});
test('WhatsApp receipt includes farm, itemized purchase, discount, net payment and thanks',()=>{
 const text=receiptMessage({farm_name:'Fresh Dairy',receipt_number:'POS-TEST',customer_name:'Ali',created_at:'2026-10-11T12:00:00Z',currency:'PKR',subtotal:'300.00',discount_type:'percent',discount_value:'10.00',discount_amount:'30.00',total:'270.00',payment_method:'Cash',amount_received:'500.00',change_due:'230.00',items:[{name:'Milk',quantity:'1.5',unit:'litre',unit_price:'200.00',total:'300.00'}]});
 for(const value of ['Fresh Dairy','Customer: Ali','Milk: 1.5 litre','Subtotal: PKR 300.00','Discount (10%): -PKR 30.00','Total paid: PKR 270.00','Change: PKR 230.00','Thank you for shopping with Fresh Dairy!'])assert.ok(text.includes(value),value);
});
