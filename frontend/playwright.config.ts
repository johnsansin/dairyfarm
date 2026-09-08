import {defineConfig} from '@playwright/test';
import 'dotenv/config';
export default defineConfig({testDir:'./tests',workers:1,use:{baseURL:process.env.E2E_BASE_URL || process.env.APP_ORIGIN || 'http://localhost:3000',headless:true},reporter:'list'});
