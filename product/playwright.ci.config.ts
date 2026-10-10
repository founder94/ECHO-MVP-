import { defineConfig } from '@playwright/test';
import local from './playwright.config';

export default defineConfig(local, {
  forbidOnly: true,
  failOnFlakyTests: true,
  retries: 2,
  workers: 2,
  outputDir: 'test-results/ci',
  reporter: [['list'], ['junit', { outputFile: 'test-results/e2e.xml' }], ['html', { outputFolder: 'playwright-report/ci', open: 'never' }]],
});
