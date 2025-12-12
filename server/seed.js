const bcrypt = require('bcryptjs');
const { pool, initDB } = require('./db');

const seedDatabase = async () => {
  try {
    console.log('Checking if database needs seeding...');

    // Check if admin user exists
    const userCheck = await pool.query('SELECT id, role FROM users WHERE username = $1', ['admin']);

    if (userCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      await pool.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', ['admin', hashedPassword, 'admin']);
      console.log('✓ Admin user created (username: admin, password: admin, role: admin)');
    } else {
      // Update existing admin user to have admin role
      await pool.query('UPDATE users SET role = $1 WHERE username = $2', ['admin', 'admin']);
      console.log('✓ Admin user verified');
    }

    // Check if welcome page exists
    const pageCheck = await pool.query('SELECT id FROM pages WHERE slug = $1', ['welcome']);

    if (pageCheck.rows.length === 0) {
      const welcomeContent = `[h1]Welcome to BBCode Wiki[/h1]

This is a BBCode-based wiki editor with a layout inspired by Steamworks Documentation.

[h2]Getting Started[/h2]

This wiki supports full BBCode formatting. Here are some examples:

[h3]Text Formatting[/h3]
[list]
[*][b]Bold text[/b] - Use [noparse][b]text[/b][/noparse]
[*][i]Italic text[/i] - Use [noparse][i]text[/i][/noparse]
[*][u]Underlined text[/u] - Use [noparse][u]text[/u][/noparse]
[*][strike]Strikethrough text[/strike] - Use [noparse][strike]text[/strike][/noparse]
[/list]

[h3]Links and Images[/h3]
You can add links: [url=https://example.com]Example Website[/url]

And images using the upload feature and [noparse][img]url[/img][/noparse] tag.

[h3]Lists[/h3]
Ordered lists:
[olist]
[*]First item
[*]Second item
[*]Third item
[/olist]

[h3]Code Blocks[/h3]
[code]function example() {
  console.log("Hello, world!");
}[/code]

[h3]Quotes[/h3]
[quote=John Doe]This is a quoted text with attribution.[/quote]

[hr]

[b]Login credentials:[/b]
Username: admin
Password: admin

[i]You can now edit this page or create new pages using the navigation menu![/i]`;

      await pool.query(
        'INSERT INTO pages (slug, title, content, parent_id, display_order) VALUES ($1, $2, $3, $4, $5)',
        ['welcome', 'Welcome', welcomeContent, null, 0]
      );
      console.log('✓ Welcome page created');
    } else {
      console.log('✓ Welcome page verified');
    }

    console.log('✓ Database seeded successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
    throw err;
  }
};

// Allow running directly with node server/seed.js
if (require.main === module) {
  (async () => {
    try {
      await initDB();
      await seedDatabase();
      console.log('\nDatabase ready!');
      process.exit(0);
    } catch (err) {
      console.error('Seed failed:', err);
      process.exit(1);
    }
  })();
}

module.exports = { seedDatabase };

