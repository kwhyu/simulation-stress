const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

app.post('/run-scenarios', async (req, res) => {
  const { scenarios } = req.body;

  if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty scenarios.' });
  }

  const results = [];
  try {
    const browser = await puppeteer.launch({ headless: true });

    for (const scenario of scenarios) {
      const { url, users, element, clicks, input, duration } = scenario;

      const scenarioResults = [];
      for (let user = 0; user < users; user++) {
        const page = await browser.newPage();
        try {
          await page.goto(url);

          if (input) {
            await page.type(element, input);
          }

          for (let i = 0; i < clicks; i++) {
            await page.click(element);
          }

          await page.waitForTimeout(duration * 1000);

          scenarioResults.push({ user, status: 'Success' });
        } catch (error) {
          scenarioResults.push({ user, error: error.message });
        } finally {
          await page.close();
        }
      }

      results.push({ url, scenarioResults });
    }

    await browser.close();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});