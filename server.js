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
      const { url, inputField, inputValue, button, repeats } = scenario;

      const scenarioResults = [];
      for (let i = 0; i < repeats; i++) {
        const page = await browser.newPage();
        try {
          await page.goto(url);

          // Input text into the specified field
          if (inputField && inputValue) {
            await page.type(inputField, inputValue);
          }

          // Click the specified button
          if (button) {
            await page.click(button);
          }

          scenarioResults.push({ iteration: i + 1, status: 'Success' });
        } catch (error) {
          scenarioResults.push({ iteration: i + 1, error: error.message });
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
