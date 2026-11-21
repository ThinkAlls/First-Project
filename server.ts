import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import authRoutes from './src/server/routes/auth.ts';
import publicRoutes from './src/server/routes/public.ts';
import adminFinanceRoutes from './src/server/routes/admin-finance.ts';
import adminContentRoutes from './src/server/routes/admin-content.ts';
import adminSystemRoutes from './src/server/routes/admin-system.ts';
import webhookRoutes from './src/server/routes/webhooks.ts';
import { UPLOADS_DIR } from './src/server/middleware/upload.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', true);
  app.use(
    express.json({
      limit: '4mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  // Securely serve uploaded files with path confinement check
  app.get('/uploads/:filename', (req, res) => {
    const rawName = path.basename(req.params.filename || '');
    const resolved = path.resolve(UPLOADS_DIR, rawName);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File tidak ditemukan.' });
    }
    return res.sendFile(resolved);
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/admin/finance', adminFinanceRoutes);
  app.use('/api/admin/content', adminContentRoutes);
  app.use('/api/admin/system', adminSystemRoutes);

  // Multer & API error handler
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('API Error:', err);
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran file melebihi batas maksimal 5 MB.'
        : err.message || 'Terjadi kesalahan pada server.';
    res.status(status).json({ error: message });
  });

  // Vite middleware in development, static dist/ in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MasjidKu server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
