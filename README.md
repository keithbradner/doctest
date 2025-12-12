# BBCode Wiki Editor

A BBCode-based wiki editor with a layout inspired by Steamworks Documentation. Features include user authentication, hierarchical page navigation, image uploads, and full BBCode support.

## Features

- 🔐 User authentication (login required to view/edit)
- 📝 Full BBCode editor with toolbar and live preview
- 🗂️ Hierarchical page navigation with parent/child relationships
- 🖼️ Image upload functionality (stored in PostgreSQL)
- 🎨 Steamworks Documentation-inspired UI
- 🗃️ PostgreSQL database backend
- ⚛️ React frontend

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

## Installation

### 1. Set up PostgreSQL

Create a new PostgreSQL database:

```bash
createdb bbcode_wiki
```

Or using psql:

```sql
CREATE DATABASE bbcode_wiki;
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and update the database credentials if needed:

```
DB_USER=postgres
DB_HOST=localhost
DB_NAME=bbcode_wiki
DB_PASSWORD=postgres
DB_PORT=5432
JWT_SECRET=bbcode-wiki-secret-key-change-in-production
PORT=3001
```

### 3. Install Dependencies

Install server dependencies:

```bash
npm install
```

Install client dependencies:

```bash
cd client
npm install
cd ..
```

### 4. Seed the Database

This will create the database tables and add an admin user with a welcome page:

```bash
npm run seed
```

Default credentials:
- **Username:** admin
- **Password:** admin

## Running the Application

### Development Mode

Run both server and client concurrently:

```bash
npm run dev
```

Or run them separately:

**Terminal 1 - Server:**
```bash
npm run server
```

**Terminal 2 - Client:**
```bash
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Production Build

Build the React app:

```bash
npm run build
```

Then serve the built files with your preferred static server or configure Express to serve them.

## Usage

### Login

1. Navigate to http://localhost:3000
2. You'll be redirected to the login page
3. Login with the default credentials (admin/admin)

### Creating Pages

1. Click the "+ New Page" button in the sidebar
2. Enter a slug (URL-friendly name, e.g., "my-page")
3. Enter a title
4. Optionally select a parent page for hierarchical organization
5. Click "Create Page"

### Editing Pages

1. Click on any page in the sidebar to view it
2. Click the "Edit Page" button
3. Use the toolbar to insert BBCode or type it manually
4. Switch to "Preview" tab to see how it will look
5. Click "Save Changes" when done

### BBCode Reference

#### Headers
```
[h1]Large Header[/h1]
[h2]Medium Header[/h2]
[h3]Small Header[/h3]
```

#### Text Formatting
```
[b]Bold text[/b]
[i]Italic text[/i]
[u]Underlined text[/u]
[strike]Strikethrough text[/strike]
```

#### Links
```
[url=https://example.com]Link Text[/url]
[url]https://example.com[/url]
```

#### Images
1. Click "Upload Image" in the toolbar
2. Select an image file
3. The BBCode will be automatically inserted: `[img]/api/images/ID[/img]`

Or manually:
```
[img]https://example.com/image.jpg[/img]
```

#### Lists

Unordered:
```
[list]
[*]First item
[*]Second item
[*]Third item
[/list]
```

Ordered:
```
[olist]
[*]First item
[*]Second item
[*]Third item
[/olist]
```

#### Code Blocks
```
[code]
function example() {
  console.log("Hello!");
}
[/code]
```

#### Quotes
```
[quote=Author Name]Quoted text here[/quote]
[quote]Anonymous quote[/quote]
```

#### Other Tags
```
[hr]                              - Horizontal rule
[spoiler]Hidden text[/spoiler]    - Spoiler (hover to reveal)
[noparse][b]Not parsed[/b][/noparse] - Don't parse BBCode inside
```

## Database Schema

### users
- `id` - Serial primary key
- `username` - Unique username
- `password` - Bcrypt hashed password
- `created_at` - Timestamp

### pages
- `id` - Serial primary key
- `slug` - Unique URL slug
- `title` - Page title
- `content` - BBCode content
- `parent_id` - Optional parent page ID (for hierarchy)
- `display_order` - Order in navigation
- `is_expanded` - Whether child pages are shown by default
- `created_at` - Timestamp
- `updated_at` - Timestamp

### images
- `id` - Serial primary key
- `filename` - Original filename
- `data` - Binary image data (BYTEA)
- `mime_type` - Image MIME type
- `created_at` - Timestamp

## API Endpoints

### Authentication
- `POST /api/login` - Login with username/password
- `POST /api/logout` - Logout current user
- `GET /api/auth/check` - Check authentication status

### Pages
- `GET /api/pages` - Get all pages (for navigation)
- `GET /api/pages/:slug` - Get single page with rendered HTML
- `POST /api/pages` - Create new page (authenticated)
- `PUT /api/pages/:slug` - Update page (authenticated)
- `DELETE /api/pages/:slug` - Delete page (authenticated)

### Images
- `POST /api/images` - Upload image (authenticated)
- `GET /api/images/:id` - Get image

## Technology Stack

### Backend
- Node.js & Express
- PostgreSQL (pg driver)
- bcryptjs (password hashing)
- jsonwebtoken (JWT authentication)
- multer (file uploads)

### Frontend
- React 18
- React Router
- Axios (HTTP client)
- CSS (custom Steamworks-inspired styling)

## Security Notes

- Change the `JWT_SECRET` in `.env` for production use
- Change the default admin password after first login
- Ensure PostgreSQL is properly secured
- Consider adding HTTPS in production
- The app uses httpOnly cookies for JWT tokens

## License

MIT