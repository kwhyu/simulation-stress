const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // Serve the HTML file in the "public" directory

app.post('/run-scenarios', async (req, res) => {
  const { scenarios } = req.body;

  if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty scenarios.' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const results = [];
    for (const scenario of scenarios) {
      const { url, repeats, duration, users, inputField, inputValue, button } = scenario;

      const scenarioResults = {
        url,
        totalTests: users * repeats,
        successCount: 0,
        errorCount: 0,
        totalLoadTime: 0,
        avgLoadTime: 0,
        successRate: 0,
        errorRate: 0,
      };

      for (let i = 0; i < users; i++) {
        for (let j = 0; j < repeats; j++) {
          const page = await browser.newPage();
          try {
            const startTime = performance.now();
            await page.goto(url, { waitUntil: 'load', timeout: duration });
            const endTime = performance.now();

            scenarioResults.totalLoadTime += endTime - startTime;

            if (inputField && inputValue) {
              await page.type(inputField, inputValue);
            }

            if (button) {
              await page.click(button);
            }

            scenarioResults.successCount++;
          } catch (error) {
            console.error('Error during test:', error.message);
            scenarioResults.errorCount++;
          } finally {
            await page.close();
          }
        }
      }

      scenarioResults.avgLoadTime =
        scenarioResults.successCount > 0
          ? (scenarioResults.totalLoadTime / scenarioResults.successCount).toFixed(2)
          : 0;

      scenarioResults.successRate = (
        (scenarioResults.successCount / scenarioResults.totalTests) *
        100
      ).toFixed(2);

      scenarioResults.errorRate = (
        (scenarioResults.errorCount / scenarioResults.totalTests) *
        100
      ).toFixed(2);

      results.push(scenarioResults);
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
