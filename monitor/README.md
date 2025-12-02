# Monitor Automate

Automation project using Playwright and TypeScript, configured for Chrome browser only.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers (Chromium only):
```bash
npm run install:browsers
```

3. Set up environment variables:
```bash
cp env.example .env
```
Edit `.env` and add your Graylog credentials:
- `GRAYLOG_URL` - The base URL for Graylog (default: `https://gray.prod.bjsrestaurants.com`)
- `GRAYLOG_USERNAME` - Your Graylog username
- `GRAYLOG_PASSWORD` - Your Graylog password

## Usage

### Run tests
```bash
npm test
```

### Run tests in headed mode (visible browser)
```bash
npm run test:headed
```

### Run tests in debug mode
```bash
npm run test:debug
```

### Run tests with UI mode
```bash
npm run test:ui
```

### Generate code using Playwright Codegen
```bash
npm run codegen
```

## Project Structure

```
monitor-automate/
├── src/              # Test files and automation scripts
│   ├── graylog/      # Graylog automation scripts
│   │   ├── helper.ts # Graylog helper functions (login, etc.)
│   │   └── *.spec.ts # Test files
│   └── config.ts     # Configuration helper
├── dist/             # Compiled TypeScript output
├── .env              # Environment variables (create from env.example)
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

## Environment Variables

The project uses environment variables for configuration. Configure these in `.env`:

- `GRAYLOG_URL` - The base URL for Graylog (default: `https://gray.prod.bjsrestaurants.com`)
- `GRAYLOG_USERNAME` - Your Graylog username
- `GRAYLOG_PASSWORD` - Your Graylog password

You can access them in your tests using the config helper:
```typescript
import { config } from './config';

// Use config.graylogUrl in your tests
await page.goto(config.graylogUrl);
```

Or use Playwright's baseURL (automatically set from GRAYLOG_URL):
```typescript
// Since baseURL is configured, you can use relative paths
await page.goto('/');
```

## Graylog Helper Functions

The project includes a `GraylogHelper` class for common Graylog operations:

```typescript
import { GraylogHelper } from './graylog/helper';

test('my test', async ({ page }) => {
  const graylogHelper = new GraylogHelper(page);
  
  // Login to Graylog
  await graylogHelper.login();
  
  // Or check if already logged in and login if needed
  await graylogHelper.ensureLoggedIn();
  
  // Check login status
  const isLoggedIn = await graylogHelper.isLoggedIn();
});
```

The `login()` method automatically uses credentials from your `.env` file. You can also pass custom credentials:
```typescript
await graylogHelper.login('custom_username', 'custom_password');
```

## Writing Tests

Create your test files in the `src/` directory. Example:

```typescript
import { test, expect } from '@playwright/test';

test('my test', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});
```

## Configuration

The project is configured to use Chrome (Chromium) only. You can modify `playwright.config.ts` to adjust settings like:
- Timeouts
- Screenshot/video capture
- Base URL
- Test directory

## Resources

- [Playwright Documentation](https://playwright.dev)
- [TypeScript Documentation](https://www.typescriptlang.org)

