const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

let logs = [];

// Fungsi untuk menambahkan log
function addLogEntry(message, type = 'info') {
  logs.push({
    timestamp: new Date(),
    message,
    type,
  });
}

// API untuk mengambil log
app.get('/get-logs', (req, res) => {
  res.json(logs);
});

// API untuk menjalankan skenario
app.post('/run-scenarios', async (req, res) => {
  let scenarios = req.body.scenarios;

  // Validasi input
  if (!scenarios || scenarios.length === 0) {
    res.status(400).json({ error: 'No scenarios provided.' });
    return;
  }

  addLogEntry(`Received scenarios: ${JSON.stringify(scenarios)}`);

  // Jika lebih dari satu skenario, ambil hanya satu
  if (scenarios.length > 1) {
    addLogEntry(`Warning: Multiple scenarios detected (${scenarios.length}).`);
    scenarios = scenarios.slice(0, 1); // Ambil hanya skenario pertama
    addLogEntry(`Only the first scenario will be executed.`);
  }

  const results = [];

  for (const [index, scenario] of scenarios.entries()) {
    try {
      addLogEntry(`Running scenario ${index + 1}...`);

      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const { url, users, repeats, duration, inputField, inputValue, button } = scenario;

      // Validasi properti skenario
      if (!url || !users || !repeats || !duration) {
        addLogEntry(
          `Scenario ${index + 1} skipped: Missing required fields. (url: ${url}, users: ${users}, repeats: ${repeats}, duration: ${duration})`,
          'error'
        );
        results.push({
          scenario: index + 1,
          status: 'Failed',
          error: 'Missing required fields in scenario.',
        });
        continue;
      }

      // Inisialisasi hasil skenario
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

      for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex++) {
        const userTasks = Array.from({ length: users }, async (_, userIndex) => {
          try {
            const page = await browser.newPage();
            const startTime = Date.now();

            await page.goto(url, { waitUntil: 'networkidle2' });
            const loadTime = Date.now() - startTime;

            scenarioResults.successCount++;
            scenarioResults.totalLoadTime += loadTime;

            addLogEntry(
              `Scenario ${index + 1}, User ${userIndex + 1}, Repeat ${repeatIndex + 1}: Success (${loadTime}ms)`,
              'success'
            );

            // Simulate input if selectors are provided
            if (inputField && inputValue) {
              await page.type(inputField, inputValue);
              addLogEntry(
                `Scenario ${index + 1}: Typed '${inputValue}' into '${inputField}'`,
                'success'
              );
            }

            // Click button if provided
            if (button) {
              await page.click(button);
              addLogEntry(
                `Scenario ${index + 1}: Clicked button '${button}'`,
                'success'
              );
            }

            await page.close();
          } catch (error) {
            scenarioResults.errorCount++;
            addLogEntry(
              `Scenario ${index + 1}, User ${userIndex + 1}, Repeat ${repeatIndex + 1}: Failed (${error.message})`,
              'error'
            );
          }
        });

        // Jalankan semua tugas pengguna secara bersamaan
        await Promise.all(userTasks);

        // Tunggu durasi jika diberikan
        if (duration) {
          await new Promise((resolve) => setTimeout(resolve, duration));
        }
      }

      // Hitung rata-rata waktu muat, tingkat keberhasilan, dan tingkat kesalahan
      if (scenarioResults.successCount > 0) {
        scenarioResults.avgLoadTime =
          scenarioResults.totalLoadTime / scenarioResults.successCount;
      }
      scenarioResults.successRate =
        (scenarioResults.successCount / scenarioResults.totalTests) * 100;
      scenarioResults.errorRate =
        (scenarioResults.errorCount / scenarioResults.totalTests) * 100;

      results.push({
        scenario: index + 1,
        status: 'Success',
        details: scenarioResults,
      });

      await browser.close();
      addLogEntry(`Scenario ${index + 1} completed successfully.`, 'success');
    } catch (error) {
      results.push({
        scenario: index + 1,
        status: 'Failed',
        error: error.message,
      });
      addLogEntry(`Scenario ${index + 1} failed: ${error.message}`, 'error');
    }
  }

  // Mengembalikan hanya hasil skenario pertama, meskipun ada banyak skenario
  res.json({ results: results.slice(0, 1) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  addLogEntry(`Server running on port ${PORT}`, 'info');
});
