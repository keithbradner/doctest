# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BBCode Wiki Editor - A wiki application with BBCode markup, PostgreSQL backend, and React frontend. UI inspired by Steamworks Documentation.

## Commands

### Development
```bash
npm run dev          # Run both server (port 3001) and client (port 3000) concurrently
npm run server       # Server only
npm run client       # Client only (from root)
```

### Build
```bash
npm run build        # Build React client for production
```

### Database
```bash
npm run seed         # Initialize database tables and create admin user (admin/admin)
```

### Testing
Tests require the server running on port 3001 (`npm run server`).

```bash
npm run test:all         # Run all test suites
npm run test:bbcode      # BBCode parser tests
npm run test:htmlbbcode  # HTML-to-BBCode conversion tests
npm run test             # API tests
npm run test:deletion    # Page deletion feature tests
```

## Architecture

### Directory Structure
- `server/` - Express.js backend with all API routes in `index.js`
- `client/src/` - React frontend (Create React App)
- `shared/` - Shared code between server and client
- `tests/` - Test suites (run with Node.js, not a test framework)

### BBCode Parser (Critical)
The BBCode parser lives in `shared/bbcode.js` and is the canonical source.

**Important**: Create React App cannot import from outside `src/`, so the parser must be manually copied:
```bash
cp shared/bbcode.js client/src/utils/bbcode.js
```
Always edit `shared/bbcode.js` first, then copy to client.

### Server Structure (`server/index.js`)
Single-file Express server containing:
- Authentication middleware (JWT in httpOnly cookies)
- Admin middleware (role-based access)
- Rate limiting for login/registration
- All API endpoints (auth, pages, images, history, comments, analytics)

### Database Tables (PostgreSQL)
- `users` - User accounts with bcrypt passwords, roles, and cursor_color
- `pages` - Wiki pages with hierarchical structure (parent_id), soft delete support (deleted_at)
- `images` - Binary image storage (BYTEA)
- `page_history` - Version history with diffs
- `page_comments` - Talk page discussions
- `page_views` - Analytics tracking
- `page_drafts` - Collaborative editing drafts (shared between users)
- `editing_sessions` - Active editing/viewing sessions for presence tracking

### Real-time Collaboration (`server/collab/`)
Socket.io-based real-time collaborative editing:
- `index.js` - Socket.io setup, authentication middleware, room management
- `handlers.js` - Event handlers (join, leave, content-change, cursor-move, publish, revert)
- `draftManager.js` - Draft CRUD operations
- `presenceManager.js` - User presence tracking
- `cursorManager.js` - Cursor position and color management

**Protocol**: Users join a room per page. Changes broadcast to all users in room. Drafts auto-save to database, require explicit "Publish" to save to live page. "Revert" discards draft.

### Client Collaboration (`client/src/collab/`)
- `socketClient.js` - Socket.io client singleton
- `useCollaboration.js` - React hook managing content sync, presence, cursors
- `PresenceBar.js` - Shows who's editing/viewing
- `CursorOverlay.js` - Renders remote cursors over textarea
- `CollabControls.js` - Connection status, draft indicator, Publish/Revert buttons

### Client Components (`client/src/components/`)
- `PageView.js` - Page display with BBCode rendering
- `PageEdit.js` - BBCode editor with toolbar and preview
- `Sidebar.js` - Hierarchical page navigation
- `AdminDashboard.js` - User/page management, analytics
- `PageHistory.js` - Version history viewer
- `PageTalk.js` - Discussion/comments

## Environment Variables

Required in `.env`:
- `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT` - PostgreSQL connection (or `DATABASE_URL` for Railway)
- `JWT_SECRET` - JWT signing key
- `PORT` - Server port (default 3001)
