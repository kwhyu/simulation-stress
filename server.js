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
  const scenarios = req.body.scenarios;

  if (!scenarios || scenarios.length === 0) {
    res.status(400).json({ error: 'No scenarios provided.' });
    return;
  }

  const results = [];

  for (const [index, scenario] of scenarios.entries()) {
    try {
      addLogEntry(`Running scenario ${index + 1}...`);

      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const { url, users, repeats, duration, inputField, inputValue, button } =
        scenario;

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
            // Click button if provided
            if (button) {
              try {
                await page.waitForSelector(button, { timeout: 5000 }); // Tunggu hingga tombol muncul (5 detik)
                await page.click(button);
                addLogEntry(
                  `Scenario ${index + 1}: Clicked button '${button}'`,
                  'success'
                );
              } catch (error) {
                scenarioResults.errorCount++;
                addLogEntry(
                  `Scenario ${index + 1}: Failed to click button '${button}' (${error.message})`,
                  'error'
                );
              }
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

  res.json({ results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  addLogEntry(`Server running on port ${PORT}`, 'info');
});
