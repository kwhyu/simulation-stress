const express = require('express');
const bodyParser = require('body-parser');
const { Cluster } = require('puppeteer-cluster');

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

  // Inisialisasi Cluster Puppeteer
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 10000,
    puppeteerOptions: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  const results = [];

  // Proses semua skenario
  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    addLogEntry(`Running scenario ${scenarioIndex + 1}...`);

    const { url, users, repeats, inputField, inputValue, button } = scenario;

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

    // Definisikan task cluster
    await cluster.task(async ({ page, data }) => {
      const { url, inputField, inputValue, button, userIndex, repeatIndex } = data;
      const startTime = Date.now();

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 }); // Timeout 120 detik
        const loadTime = Date.now() - startTime;

        scenarioResults.successCount++;
        scenarioResults.totalLoadTime += loadTime;

        addLogEntry(
          `Scenario ${scenarioIndex + 1}, User ${userIndex + 1}, Repeat ${repeatIndex + 1}: Success (${loadTime}ms)`,
          'success'
        );

        // Simulate input jika ada inputField dan inputValue
        if (inputField && inputValue) {
          await page.type(inputField, inputValue);
          addLogEntry(
            `Scenario ${scenarioIndex + 1}: Typed '${inputValue}' into '${inputField}'`,
            'success'
          );
        }

        // Klik button jika diberikan
        if (button) {
          await page.waitForSelector(button, { timeout: 120000 });
          await page.click(button);
          addLogEntry(
            `Scenario ${scenarioIndex + 1}: Clicked button '${button}'`,
            'success'
          );
        }
      } catch (error) {
        scenarioResults.errorCount++;
        addLogEntry(
          `Scenario ${scenarioIndex + 1}, User ${userIndex + 1}, Repeat ${repeatIndex + 1}: Failed (${error.message})`,
          'error'
        );
      }
    });

    // Tambahkan semua pengguna dan pengulangan ke antrian cluster
    for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex++) {
      for (let userIndex = 0; userIndex < users; userIndex++) {
        cluster.queue({
          url,
          inputField,
          inputValue,
          button,
          userIndex,
          repeatIndex,
        });
      }
    }

    results.push({
      scenario: scenarioIndex + 1,
      status: 'Running',
      details: scenarioResults,
    });

    addLogEntry(`Scenario ${scenarioIndex + 1} queued successfully.`, 'success');
  }

  // Tunggu semua task selesai
  await cluster.idle();

  // Perhitungan statistik setelah semua task selesai
  results.forEach((result) => {
    const { details } = result;
    if (details.successCount > 0) {
      details.avgLoadTime = details.totalLoadTime / details.successCount;
    }
    details.successRate = (details.successCount / details.totalTests) * 100;
    details.errorRate = (details.errorCount / details.totalTests) * 100;
  });

  await cluster.close();

  res.json({ results });
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  addLogEntry(`Server running on port ${PORT}`, 'info');
});
