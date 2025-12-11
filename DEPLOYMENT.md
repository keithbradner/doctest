# Railway Deployment Guide

This guide explains how to deploy the BBCode Wiki to Railway.

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository connected to Railway

## Deployment Steps

### 1. Create a New Project on Railway

1. Go to https://railway.app/new
2. Select "Deploy from GitHub repo"
3. Choose this repository

### 2. Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" -> "PostgreSQL"
3. Railway will automatically create a PostgreSQL instance and set the `DATABASE_URL` environment variable

### 3. Configure Environment Variables

Add the following environment variables in Railway project settings:

```
JWT_SECRET=your-secure-random-string-here
CLIENT_URL=https://your-frontend-url.railway.app
NODE_ENV=production
```

The `DATABASE_URL` is automatically set by Railway when you add PostgreSQL.

### 4. Build Configuration

Railway will automatically detect the Node.js application and use the following scripts from `package.json`:

- **Build**: `cd client && npm install && npm run build`
- **Start**: `npm run server`

You may need to configure these in Railway settings:

**Build Command:**
```
npm install && cd client && npm install && npm run build && cd ..
```

**Start Command:**
```
npm run server
```

### 5. Serve Frontend from Backend

Update `server/index.js` to serve the built React app:

```javascript
// Add before routes
const path = require('path');

// Serve static files from React app
app.use(express.static(path.join(__dirname, '../client/build')));

// Add after all API routes, before initDB()
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});
```

### 6. Database Initialization

After deployment, you need to seed the database:

1. Go to Railway project settings
2. Open the PostgreSQL database
3. Click "Query" tab
4. Run the seed script manually or use Railway's command feature:

```bash
npm run seed
```

Or set up a one-time deployment task in Railway.

### 7. Access Your Application

Once deployed, Railway will provide you with a URL like:
```
https://your-app-name.up.railway.app
```

The default login credentials are:
- Username: `admin`
- Password: `admin`

**IMPORTANT**: Change the admin password immediately after first login!

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes (auto-set by Railway) |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `CLIENT_URL` | Frontend URL for CORS | Optional |
| `PORT` | Server port | No (Railway sets this automatically) |
| `NODE_ENV` | Environment (production/development) | Optional |

## Troubleshooting

### Database Connection Issues

If you see database connection errors:
1. Check that `DATABASE_URL` is set in Railway
2. Verify SSL configuration in `server/db.js`
3. Check Railway PostgreSQL logs

### CORS Issues

If you encounter CORS errors:
1. Add your Railway domain to allowed origins in `server/index.js`
2. Set `CLIENT_URL` environment variable to your frontend URL

### Build Failures

If the build fails:
1. Check build logs in Railway dashboard
2. Verify all dependencies are listed in `package.json`
3. Ensure React build completes successfully locally first

## Cost Estimation

Railway offers:
- **Free tier**: $5/month credit (suitable for testing)
- **Pro tier**: Pay-as-you-go pricing

Typical usage for this app:
- PostgreSQL: ~$5-10/month
- Web service: ~$5-10/month (depends on traffic)

## Security Recommendations

1. Change default admin password
2. Use strong `JWT_SECRET`
3. Enable Railway's built-in DDoS protection
4. Set up backups for PostgreSQL database
5. Monitor logs for suspicious activity
6. Consider adding rate limiting for API endpoints

## Updates and Maintenance

Railway automatically deploys when you push to your connected Git branch.

To update the application:
1. Push changes to GitHub
2. Railway will automatically build and deploy
3. Monitor deployment logs for any issues

## Backup and Recovery

### Database Backups

Railway provides automatic daily backups. To manually backup:

1. Use Railway CLI or dashboard to export database
2. Store backups securely off-platform

### Restoring from Backup

1. Create new PostgreSQL instance in Railway
2. Import backup data
3. Update `DATABASE_URL` to point to new database

## Support

For Railway-specific issues:
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

For application issues:
- Check application logs in Railway dashboard
- Review server logs for errors
- Test locally to isolate Railway-specific problems
