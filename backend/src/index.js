const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const invoicesRouter = require('./routes/invoices');
const authRouter = require('./routes/auth');

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(bodyParser.json({ limit: '5mb' }));
app.use('/api/invoices', invoicesRouter);
app.use('/api/auth', authRouter);
app.get('/api/health', (req,res)=>res.json({ ok:true }));

const port = process.env.PORT || 8000;
app.listen(port, ()=> console.log(`Server running on http://localhost:${port}`));
