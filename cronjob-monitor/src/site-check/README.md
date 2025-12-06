# Site Check - Playwright Tests

This folder contains Playwright tests for checking the BJs menu website.

## Setup

1. Install dependencies (from project root):
```bash
npm install
```

2. Install Playwright browsers:
```bash
npm run install:browsers
```

3. Set up environment variables in `.env` file (in project root):
```bash
BJs_Web_Url=https://your-bjs-website.com
BJs_Menu_Path=/menu
```

## Running Tests

### Run tests (headless):
```bash
npm run test:site-check
```

### Run tests with visible browser:
```bash
npm run test:site-check:headed
```

### Run tests in debug mode:
```bash
npm run test:site-check:debug
```

## Test Files

- `menu.spec.ts` - Tests for visiting the BJs menu page

## Configuration

The Playwright configuration is in `playwright.config.ts`:
- Uses Chromium browser
- Runs in headed mode (visible browser)
- Maximized window
- 30-minute timeout per test
- HTML reporter for test results

