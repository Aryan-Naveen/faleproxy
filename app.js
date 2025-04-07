const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to replace Yale with Fale while preserving case
function replaceYaleWithFale(text) {
  return text.replace(/Yale/g, 'Fale')
             .replace(/YALE/g, 'FALE')
             .replace(/yale/g, 'fale');
}

// Helper function to process text nodes
function processTextNodes($, replacementCount) {
  // Process text nodes
  $('*').each(function() {
    // Skip script tags
    if ($(this).is('script')) {
      return;
    }

    // Handle text nodes
    $(this).contents().filter(function() {
      return this.type === 'text';
    }).each(function() {
      const text = this.data;
      const newText = replaceYaleWithFale(text);
      if (text !== newText) {
        replacementCount.value += (text.match(/yale/gi) || []).length;
        this.data = newText;
      }
    });

    // Handle elements that only contain text (no children)
    if ($(this).children().length === 0) {
      const text = $(this).text();
      const newText = replaceYaleWithFale(text);
      if (text !== newText) {
        replacementCount.value += (text.match(/yale/gi) || []).length;
        $(this).text(newText);
      }
    }
  });

  // Process text nodes in the root level
  $.root().contents().filter(function() {
    return this.type === 'text';
  }).each(function() {
    const text = this.data;
    const newText = replaceYaleWithFale(text);
    if (text !== newText) {
      replacementCount.value += (text.match(/yale/gi) || []).length;
      this.data = newText;
    }
  });
}

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the content from the provided URL
    const response = await axios.get(url);
    const html = response.data;

    // Use cheerio to parse HTML
    const $ = cheerio.load(html);
    const replacementCount = { value: 0 };
    
    // Process all text nodes
    processTextNodes($, replacementCount);

    // Return the modified content with metadata
    return res.json({ 
      success: true, 
      content: $.html(),
      title: $('title').text(),
      originalUrl: url,
      replacementCount: replacementCount.value
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: `Failed to fetch content: ${error.message}` 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Faleproxy server running at http://localhost:${PORT}`);
});

module.exports = { app, PORT };
