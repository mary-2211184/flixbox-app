// 1. DIRECT DNS PATCH (Bypasses local ISP blocks)
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

// 2. REQUIRED DEPENDENCIES
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// 3. MIDDLEWARE CONFIGURATIONS
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Setup Session Handling for Authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'flixbox_fallback_secret',
  resave: false,
  saveUninitialized: false
}));

// Setup Local File Upload Storage Engine (Option B Fallback)
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 4. DATABASE MODELS
const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  isPremium: { type: Boolean, default: false },
  filePath: { type: String, required: true },
  posterUrl: { type: String, default: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1364&auto=format&fit=crop' }
});
const Video = mongoose.model('Video', VideoSchema);

// Database Connection Manager
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🚀 Database connected successfully to FlixBox Cluster!'))
  .catch(err => console.error('Database connection error:', err.message));

// Middleware to inject user data into EJS views automatically
app.use(async (req, res, next) => {
  res.locals.user = req.session.userId ? await User.findById(req.session.userId) : null;
  next();
});

// 5. APPLICATION ROUTES

// Homepage Layout (Shows everything across all categories)
app.get('/', async (req, res) => {
  try {
    const videos = await Video.find();
    const categories = [...new Set(videos.map(v => v.category))];
    res.render('home', { videos, categories, currentCategory: null });
  } catch (err) {
    res.status(500).send('Error rendering home screen: ' + err.message);
  }
});

// Category Filtering Endpoint (Makes Live TV, Sports, Movies, Music tabs work!)
app.get('/category/:name', async (req, res) => {
  try {
    const targetCategory = req.params.name;
    const videos = await Video.find({ category: targetCategory });
    
    res.render('home', { 
      videos, 
      categories: [targetCategory], 
      currentCategory: targetCategory 
    });
  } catch (err) {
    res.status(500).send('Error loading category: ' + err.message);
  }
});

// Stream Player Launch Page
app.get('/watch/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).send('Content not found');
    res.render('watch', { video });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Auth Routes (Sign Up & Login)
app.get('/signup', (req, res) => res.render('signup'));
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    await User.create({ email, password });
    res.redirect('/login');
  } catch (err) {
    res.send('Registration failed: Username might already exist.');
  }
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (user) {
    req.session.userId = user._id;
    res.redirect('/');
  } else {
    res.send('Invalid login credentials provided.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Streaming Dashboard
app.get('/upload', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('upload');
});

app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.session.userId) return res.redirect('/login');
    
    const { title, category, isPremium, liveUrl, posterUrl } = req.body;
    let finalPath = '';

    if (liveUrl && liveUrl.trim() !== '') {
      finalPath = liveUrl.trim();
    } else if (req.file) {
      finalPath = `/uploads/${req.file.filename}`;
    } else {
      return res.send('Please provide a live streaming link or upload a file.');
    }

    await Video.create({
      title,
      category: category.trim(),
      isPremium: isPremium === 'on',
      filePath: finalPath,
      posterUrl: posterUrl && posterUrl.trim() !== '' ? posterUrl.trim() : undefined
    });

    res.redirect('/');
  } catch (err) {
    res.status(500).send('Error publishing content: ' + err.message);
  }
});

// 6. DYNAMIC CLOUD PORT BINDING
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
