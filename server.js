const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk parsing JSON
app.use(bodyParser.json());
app.use(express.static('public'));

// Middleware untuk logging permintaan
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Endpoint utama
app.post('/run-scenarios', async (req, res, next) => {
  const { scenarios } = req.body;

  // Validasi input
  if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty scenarios.' });
  }

  let browser;
  try {
    // Meluncurkan Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const results = [];
    for (const scenario of scenarios) {
      const { url, repeats, duration, users, inputField, inputValue, button } = scenario;

      // Validasi setiap skenario
      if (!url || !repeats || !duration || !users) {
        throw new Error('Missing mandatory fields in scenario.');
      }

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

            // Jika ada input field dan nilai
            if (inputField && inputValue) {
              await page.type(inputField, inputValue);
            }

            // Jika ada tombol untuk diklik
            if (button) {
              await page.click(button);
            }

            scenarioResults.successCount++;
          } catch (error) {
            console.error(`Error during test on ${url}:`, error.message);
            scenarioResults.errorCount++;
          } finally {
            await page.close();
          }
        }
      }

      // Hitung statistik
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

    // Kirimkan hasil sebagai JSON
    console.log('Response to client:', { success: true, results });
    res.json({ success: true, results });
  } catch (error) {
    console.error('Server error:', error.message);
    next(error);
  } finally {
    // Tutup browser jika sudah selesai
    if (browser) await browser.close();
  }
});

// Middleware global untuk error handling
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  res.status(500).json({ success: false, error: err.message });
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
