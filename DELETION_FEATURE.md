# Page Deletion Feature

This document describes the page deletion feature implementation for the BBCode Wiki application.

## Overview

The deletion feature implements a **soft delete** system where pages are marked as deleted but not removed from the database. This preserves page history and allows administrators to restore deleted pages or permanently delete them.

## Features

### 1. Soft Delete (User Feature)
- Users can delete pages using the "Delete Page" button on any page
- Deleted pages are hidden from navigation and regular page listings
- Deleted pages cannot be accessed by regular users
- History is preserved for potential restoration
- Confirmation dialog warns user that admins can restore the page

### 2. Admin Management
- New "Deleted Pages" tab in Admin Dashboard
- View all deleted pages with deletion timestamps
- **Restore** functionality to undelete pages
- **Delete Forever** button for permanent deletion (removes all data including history)
- Strong confirmation required for permanent deletion

### 3. History Preservation
- All edit history is retained when pages are soft deleted
- When a page is restored, all history remains intact
- If a new page is created with the same slug as a deleted page, the deleted page is restored with the new content

## Implementation Details

### Database Changes

**File**: `server/db.js`

Added `deleted_at` column to pages table:
```sql
ALTER TABLE pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
```

This column is:
- `NULL` for active pages
- Set to `CURRENT_TIMESTAMP` when page is soft deleted
- Set back to `NULL` when page is restored

### API Endpoints

**File**: `server/index.js`

#### Modified Endpoints

1. **GET /api/pages**
   - Now filters out deleted pages: `WHERE deleted_at IS NULL`

2. **GET /api/pages/:slug**
   - Returns 404 for deleted pages

3. **PUT /api/pages/:slug**
   - Cannot update deleted pages

4. **DELETE /api/pages/:slug**
   - Changed from hard delete to soft delete
   - Sets `deleted_at = CURRENT_TIMESTAMP`

5. **POST /api/pages**
   - Checks if slug exists with deleted page
   - If deleted page exists, restores it with new content

#### New Admin Endpoints

1. **GET /api/admin/deleted-pages** (Admin only)
   - Returns all pages where `deleted_at IS NOT NULL`
   - Ordered by deletion date (newest first)
   - Location: Line 598

2. **POST /api/admin/pages/:slug/restore** (Admin only)
   - Sets `deleted_at = NULL` to restore page
   - Location: Line 611

3. **DELETE /api/admin/pages/:slug/permanent** (Admin only)
   - Performs hard delete: `DELETE FROM pages WHERE slug = $1`
   - Cascades to delete all history, comments, and views
   - Location: Line 632

### Frontend Changes

#### PageView Component

**File**: `client/src/components/PageView.js`

Added delete functionality:
- New "Delete Page" button (Line 91-93)
- `handleDelete` function for soft delete (Lines 30-44)
- Confirmation dialog
- Redirects to home page after deletion
- Calls `onUpdate` callback if provided

#### AdminDashboard Component

**File**: `client/src/components/AdminDashboard.js`

Added deleted pages management:
- New `deletedPages` state (Line 11)
- Loads deleted pages when "Deleted Pages" tab is active (Lines 41-44)
- New "Deleted Pages" tab button (Lines 197-200)
- Deleted pages table view (Lines 451-495)
- `handleRestorePage` function (Lines 131-143)
- `handlePermanentDelete` function (Lines 145-157)

#### Styling

**File**: `client/src/App.css`

Added button styles:
- `.delete-btn`, `.delete-permanent-btn` - Red buttons for delete actions (Lines 239-253)
- `.restore-btn` - Green button for restore action (Lines 255-269)

## Testing

### Test Suite

**File**: `tests/deletion.test.js`

Comprehensive test suite with 20 tests covering:

1. **Soft Delete Flow**
   - Create page
   - Verify it appears in listings
   - Delete page
   - Verify it's hidden from listings
   - Verify 404 when accessing
   - Verify it appears in deleted pages (admin)

2. **Restoration Flow**
   - Restore deleted page
   - Verify it appears in listings again
   - Verify it can be accessed
   - Verify history is preserved

3. **Permanent Deletion**
   - Permanently delete page
   - Verify it's removed from everywhere

4. **Page Recreation**
   - Delete a page
   - Create new page with same slug
   - Verify old page is restored with new content

5. **Security**
   - Non-admin users cannot access deleted pages endpoint
   - Non-admin users cannot restore or permanently delete pages

### Running Tests

Prerequisites:
1. Install dependencies: `npm install`
2. Seed database: `npm run seed`
3. Start server: `npm run server`

Run deletion tests:
```bash
npm run test:deletion
```

Run all tests:
```bash
npm run test:all
```

See `tests/README.md` for more details.

## Security Considerations

1. **Authorization**
   - Deleted pages endpoints require admin role
   - Regular users can delete their own pages but cannot restore them
   - All admin endpoints use `requireAdmin` middleware

2. **Data Integrity**
   - Soft delete preserves referential integrity
   - Foreign key constraints remain valid
   - Cascade deletes only trigger on permanent deletion

3. **History Preservation**
   - Edit history is retained through soft deletes
   - Full audit trail maintained
   - Can reconstruct page state at any point

## User Workflows

### Deleting a Page
1. Navigate to the page
2. Click "Delete Page" button
3. Confirm in dialog
4. Redirected to home page
5. Page is hidden but can be restored by admin

### Restoring a Page (Admin Only)
1. Go to Admin Dashboard
2. Click "Deleted Pages" tab
3. Find the page in the list
4. Click "Restore" button
5. Confirm restoration
6. Page is immediately available again

### Permanently Deleting a Page (Admin Only)
1. Go to Admin Dashboard
2. Click "Deleted Pages" tab
3. Find the page in the list
4. Click "Delete Forever" button
5. Confirm with strong warning
6. Page and all history is permanently removed

## Future Enhancements

Possible improvements:
- Bulk restore/delete operations
- Deleted page preview for admins
- Automatic permanent deletion after X days
- Deleted page search functionality
- Restore to specific revision
- User permissions for who can delete pages
- Notification system for page deletions

## Database Migration

For existing installations, the `deleted_at` column will be automatically added when the server starts. The migration is safe and non-destructive:

```sql
ALTER TABLE pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
```

All existing pages will have `deleted_at = NULL` (active state).
