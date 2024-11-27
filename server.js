const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Variabel global untuk menyimpan log
const logEntries = [];

// Fungsi untuk menambahkan log
function addLogEntry(message, type = 'info') {
  const log = {
    timestamp: new Date().toISOString(),
    message,
    type,
  };
  logEntries.push(log);
  console.log(`${log.timestamp} - ${type.toUpperCase()}: ${message}`);
}

// Middleware untuk parsing JSON
app.use(bodyParser.json());
app.use(express.static('public'));

// Middleware untuk logging permintaan
app.use((req, res, next) => {
  addLogEntry(`${req.method} ${req.path}`, 'request');
  next();
});

// Endpoint untuk mendapatkan log
app.get('/get-logs', (req, res) => {
  res.json(logEntries);
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
        addLogEntry('Missing mandatory fields in scenario.', 'error');
        throw new Error('Missing mandatory fields in scenario.');
      }

      addLogEntry(`Starting scenario for URL: ${url}`, 'info');

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
            addLogEntry(`Test successful for URL: ${url}`, 'success');
          } catch (error) {
            scenarioResults.errorCount++;
            addLogEntry(
              `Error during test for URL: ${url} - ${error.message}`,
              'error'
            );
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
      addLogEntry(`Scenario completed for URL: ${url}`, 'info');
    }

    // Kirimkan hasil sebagai JSON
    addLogEntry('All scenarios completed successfully.', 'success');
    res.json({ success: true, results });
  } catch (error) {
    addLogEntry(`Server error: ${error.message}`, 'error');
    next(error);
  } finally {
    // Tutup browser jika sudah selesai
    if (browser) await browser.close();
  }
});

// Middleware global untuk error handling
app.use((err, req, res, next) => {
  addLogEntry(`Error: ${err.message}`, 'error');
  res.status(500).json({ success: false, error: err.message });
});

// Jalankan server
app.listen(PORT, () => {
  addLogEntry(`Server running on port ${PORT}`, 'info');
});
