import { z } from 'zod';
export const registration = z.object({name:z.string().trim().min(2).max(100),email:z.email().trim().toLowerCase(),password:z.string().min(6, 'Password must contain at least 6 characters').max(72).refine(v=>Buffer.byteLength(v,'utf8')<=72,'Password must be at most 72 bytes')});
export const login = registration.pick({email:true,password:true});
export const farmInput = z.object({name:z.string().trim().min(2).max(100),city:z.string().trim().min(2).max(100),currency:z.enum(['PKR','USD','GBP','EUR','AED','SAR']),organizationId:z.uuid().optional().nullable(),address:z.string().trim().max(500).default(''),email:z.union([z.email(),z.literal('')]).default('').transform(v=>v.toLowerCase()),phone:z.string().trim().max(40).default(''),country:z.string().trim().max(100).default(''),postal_code:z.string().trim().max(20).default(''),contact_name:z.string().trim().max(100).default('')});
export const organizationInput = z.object({name:z.string().trim().min(2).max(120)});
