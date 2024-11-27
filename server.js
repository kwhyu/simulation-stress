const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Route untuk menjalankan banyak skenario
app.post('/run-scenarios', async (req, res) => {
  const { scenarios } = req.body;

  if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
    return res.status(400).json({ error: 'Scenarios tidak valid atau kosong.' });
  }

  const results = [];
  try {
    const browser = await puppeteer.launch({ headless: true });

    for (const scenario of scenarios) {
      const { url, actions } = scenario;

      if (!url || !actions || !Array.isArray(actions)) {
        results.push({ url, error: 'URL atau actions tidak valid.' });
        continue;
      }

      const page = await browser.newPage();
      try {
        await page.goto(url);

        const scenarioResults = [];
        for (const action of actions) {
          const { selector, clicks } = action;

          if (!selector || typeof clicks !== 'number') {
            scenarioResults.push({ selector, error: 'Selector atau clicks tidak valid.' });
            continue;
          }

          try {
            for (let i = 0; i < clicks; i++) {
              await page.click(selector);
            }
            scenarioResults.push({ selector, clicks, status: 'Success' });
          } catch (err) {
            scenarioResults.push({ selector, error: err.message });
          }
        }

        results.push({ url, scenarioResults });
      } catch (err) {
        results.push({ url, error: err.message });
      } finally {
        await page.close();
      }
    }

    await browser.close();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
