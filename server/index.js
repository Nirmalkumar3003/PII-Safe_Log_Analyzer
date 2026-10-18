import express from 'express';
import cors from 'cors';
import piiRoutes from './routes/piiRoutes.js';

const app = express();
const PORT = 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/', piiRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
