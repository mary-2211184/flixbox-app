const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: String,
  category: String,
  filePath: String,
  isPremium: { type: Boolean, default: false },
  isLive: { type: Boolean, default: false }
});

module.exports = mongoose.model('Video', videoSchema);