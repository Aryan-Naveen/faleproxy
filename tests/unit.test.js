const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');

// Helper function to replace Yale with Fale
function replaceYaleWithFale(text) {
  return text.replace(/Yale/g, 'Fale')
             .replace(/YALE/g, 'FALE')
             .replace(/yale/g, 'fale');
}

// Helper function to normalize HTML for comparison
function normalizeHtml(html) {
  return html.replace(/\s+/g, ' ').trim();
}

// Helper function to process text nodes
function processTextNodes($) {
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
        this.data = newText;
      }
    });

    // Handle elements that only contain text (no children)
    if ($(this).children().length === 0) {
      const text = $(this).text();
      const newText = replaceYaleWithFale(text);
      if (text !== newText) {
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
      this.data = newText;
    }
  });
}

describe('Yale to Fale replacement logic', () => {
  
  test('should replace Yale with Fale in text content', () => {
    const $ = cheerio.load(sampleHtmlWithYale);
    
    // Process all text nodes
    processTextNodes($);
    
    const modifiedHtml = $.html();
    
    // Check text replacements
    expect(modifiedHtml).toContain('Fale University Test Page');
    expect(modifiedHtml).toContain('Welcome to Fale University');
    expect(modifiedHtml).toContain('Fale University is a private Ivy League');
    expect(modifiedHtml).toContain('Fale was founded in 1701');
    
    // Check that URLs remain unchanged
    expect(modifiedHtml).toContain('https://www.yale.edu/about');
    expect(modifiedHtml).toContain('https://www.yale.edu/admissions');
    expect(modifiedHtml).toContain('https://www.yale.edu/images/logo.png');
    expect(modifiedHtml).toContain('mailto:info@yale.edu');
    
    // Check href attributes remain unchanged
    expect(modifiedHtml).toMatch(/href="https:\/\/www\.yale\.edu\/about"/);
    expect(modifiedHtml).toMatch(/href="https:\/\/www\.yale\.edu\/admissions"/);
    
    // Check that link text is replaced
    expect(modifiedHtml).toContain('>About Fale<');
    expect(modifiedHtml).toContain('>Fale Admissions<');
    
    // Check that alt attributes are not changed
    expect(modifiedHtml).toContain('alt="Yale Logo"');
  });

  test('should handle text that has no Yale references', () => {
    const htmlWithoutYale = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page</title>
      </head>
      <body>
        <h1>Hello World</h1>
        <p>This is a test page with no Yale references.</p>
      </body>
      </html>
    `.trim();
    
    const $ = cheerio.load(htmlWithoutYale);
    const originalText = $('p').text().trim();
    
    // Process all text nodes
    processTextNodes($);
    
    const $modified = cheerio.load($.html());
    expect($modified('title').text()).toBe('Test Page');
    expect($modified('h1').text()).toBe('Hello World');
    expect($modified('p').text().trim()).toBe(originalText);
  });

  test('should handle case-insensitive replacements', () => {
    const mixedCaseHtml = `
      <p>YALE University, Yale College, and yale medical school are all part of the same institution.</p>
    `.trim();
    
    const $ = cheerio.load(mixedCaseHtml);
    
    // Process all text nodes
    processTextNodes($);
    
    const $modified = cheerio.load($.html());
    expect($modified('p').text().trim()).toBe('FALE University, Fale College, and fale medical school are all part of the same institution.');
  });
});
