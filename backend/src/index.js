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

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json({ limit: '5mb' }));
app.use('/api/invoices', invoicesRouter);
app.use('/api/auth', authRouter);
app.get('/api/health', (req,res)=>res.json({ ok:true }));

const port = process.env.PORT || 8000;
app.listen(port, ()=> console.log(`Server running on port ${port}`));
