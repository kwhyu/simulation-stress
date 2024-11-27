const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/run-scenarios', async (req, res) => {
  const { scenarios } = req.body;

  if (!scenarios || scenarios.length === 0) {
    return res.status(400).json({ error: 'No scenarios provided' });
  }

  const results = [];

  for (const scenario of scenarios) {
    const { url, repeats, duration, users, inputField, inputValue, button } = scenario;

    if (!url || !repeats || !duration || !users) {
      return res.status(400).json({ error: 'Missing mandatory fields in scenario' });
    }

    const scenarioResults = {
      url,
      successRate: 0,
      errorRate: 0,
      avgLoadTime: 0,
      totalTests: repeats * users,
      successCount: 0,
      errorCount: 0,
    };

    let totalLoadTime = 0;

    try {
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

      for (let i = 0; i < repeats; i++) {
        const promises = [];

        for (let j = 0; j < users; j++) {
          promises.push(
            (async () => {
              const page = await browser.newPage();
              try {
                const startTime = performance.now();
                await page.goto(url, { waitUntil: 'load', timeout: duration });
                const endTime = performance.now();

                totalLoadTime += endTime - startTime;

                if (inputField && inputValue) {
                  await page.type(inputField, inputValue);
                }

                if (button) {
                  await page.click(button);
                  await page.waitForTimeout(500); // Wait for action completion (adjust as needed)
                }

                scenarioResults.successCount++;
              } catch (err) {
                scenarioResults.errorCount++;
              } finally {
                await page.close();
              }
            })()
          );
        }

        await Promise.all(promises);
      }

      await browser.close();
    } catch (err) {
      console.error('Error running scenario:', err);
      scenarioResults.errorCount += repeats * users;
    }

    // Calculate metrics
    scenarioResults.successRate =
      ((scenarioResults.successCount / scenarioResults.totalTests) * 100).toFixed(2);
    scenarioResults.errorRate =
      ((scenarioResults.errorCount / scenarioResults.totalTests) * 100).toFixed(2);
    scenarioResults.avgLoadTime = (totalLoadTime / scenarioResults.successCount).toFixed(2);

    results.push(scenarioResults);
  }

  res.json({ success: true, results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
