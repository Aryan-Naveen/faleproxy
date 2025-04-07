const axios = require('axios');
const cheerio = require('cheerio');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');

// Set a different port for testing to avoid conflict with the main app
const TEST_PORT = 3099;
let server;

describe('Integration Tests', () => {
  beforeEach(() => {
    // Reset all nock interceptors before each test
    nock.cleanAll();
  });

  // Modify the app to use a test port
  beforeAll(async () => {
    // Mock external HTTP requests
    nock.disableNetConnect();
    nock.enableNetConnect('localhost');
    
    // Create a temporary test app file
    await execAsync('cp app.js app.test.js');
    await execAsync(`sed -i 's/const PORT = 3001/const PORT = ${TEST_PORT}/' app.test.js`);
    
    // Start the test server
    server = require('child_process').spawn('node', ['app.test.js'], {
      detached: true,
      stdio: 'ignore'
    });
    
    // Give the server time to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 10000); // Increase timeout for server startup

  afterAll(async () => {
    // Kill the test server and clean up
    if (server && server.pid) {
      process.kill(-server.pid);
    }
    await execAsync('rm app.test.js');
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Setup mock for example.com
    const scope = nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale, {
        'Content-Type': 'text/html'
      });
    
    // Make a request to our proxy app
    const response = await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
      url: 'https://example.com/'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    
    // Load both the original and modified HTML for comparison
    const $original = cheerio.load(sampleHtmlWithYale);
    const $modified = cheerio.load(response.data.content);
    
    // Verify Yale has been replaced with Fale in text
    expect($modified('title').text()).toBe('Fale University Test Page');
    expect($modified('h1').text()).toBe('Welcome to Fale University');
    expect($modified('p').first().text()).toContain('Fale University is a private');
    
    // Verify URLs remain unchanged
    const links = $modified('a');
    let hasYaleUrl = false;
    links.each((i, link) => {
      const href = $modified(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);
    
    // Verify link text is changed
    expect($modified('a').first().text()).toBe('About Fale');
    
    // Verify nock was called
    expect(scope.isDone()).toBe(true);
  }, 10000); // Increase timeout for this test

  test('Should handle invalid URLs', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
        url: 'not-a-valid-url'
      });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(500);
      expect(error.response.data.error).toContain('Failed to fetch content');
    }
  });

  test('Should handle missing URL parameter', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {});
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('URL is required');
    }
  });
});
