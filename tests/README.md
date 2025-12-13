# Tests

This directory contains tests for the BBCode Wiki application.

## Prerequisites

Before running tests, ensure:

1. **Database is set up and seeded**
   ```bash
   npm run seed
   ```

2. **Server is running on port 3001**
   ```bash
   npm run server
   ```

   Or in development mode:
   ```bash
   npm run dev
   ```

## Running Tests

### Run all tests
```bash
npm run test:all
```

### Run individual test suites

**API Tests** - Tests core API functionality:
```bash
npm run test
```

**BBCode Tests** - Tests BBCode parser:
```bash
npm run test:bbcode
```

**Deletion Tests** - Tests page deletion features:
```bash
npm run test:deletion
```

## Test Suites

### `api.test.js`
Tests core API endpoints including:
- Authentication (login, logout, auth check)
- Page CRUD operations
- Admin analytics
- User management

### `bbcode.test.js`
Tests BBCode parser functionality:
- HTML escaping and security
- All BBCode tag parsing
- Nested structures
- Special tags (callout, spoiler, code, etc.)

### `deletion.test.js`
Tests page deletion features:
- Soft delete functionality
- Deleted pages visibility
- Admin deleted pages endpoint
- Page restoration
- Permanent deletion
- History preservation
- Page recreation with same slug
- Security (non-admin access restrictions)

## Test Results

Tests will output:
- ✅ for passing tests
- ❌ for failing tests
- Summary with total/passed/failed counts

## Troubleshooting

**Connection errors**: Make sure the server is running on port 3001.

**404 errors**: Ensure the database is seeded with initial data.

**Authentication errors**: Check that admin credentials (admin/admin) exist in the database.

**Port conflicts**: If port 3001 is in use, update your `.env` file and test configuration.
