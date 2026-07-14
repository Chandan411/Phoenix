const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const invoicesRouter = require('./routes/invoices');
const authRouter = require('./routes/auth');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return /https:\/\/.+\.onrender\.com$/i.test(origin);
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));

app.options('*', cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use('/api/invoices', invoicesRouter);
app.use('/api/auth', authRouter);
app.get('/api/health', (req,res)=>res.json({ ok:true }));

const port = process.env.PORT || 8000;
app.listen(port, ()=> console.log(`Server running on port ${port}`));
