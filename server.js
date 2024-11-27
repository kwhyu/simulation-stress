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

      // Modifikasi ini menambahkan opsi `--no-sandbox` dan `--disable-setuid-sandbox`
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.goto(scenario.url);

      addLogEntry(`Scenario ${index + 1}: Opened URL ${scenario.url}`, 'success');

      // Simulate input if selectors are provided
      if (scenario.inputField && scenario.inputValue) {
        await page.type(scenario.inputField, scenario.inputValue);
        addLogEntry(`Scenario ${index + 1}: Typed '${scenario.inputValue}' into '${scenario.inputField}'`, 'success');
      }

      // Click button if provided
      if (scenario.button) {
        await page.click(scenario.button);
        addLogEntry(`Scenario ${index + 1}: Clicked button '${scenario.button}'`, 'success');
      }

      // Simulate users and repeats
      for (let i = 0; i < scenario.repeats; i++) {
        addLogEntry(`Scenario ${index + 1}: Repeat ${i + 1}/${scenario.repeats}`);
        await page.waitForTimeout(scenario.duration);
      }

      await browser.close();
      results.push({ scenario: index + 1, status: 'Success' });
      addLogEntry(`Scenario ${index + 1} completed successfully.`, 'success');
    } catch (error) {
      results.push({ scenario: index + 1, status: 'Failed', error: error.message });
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
