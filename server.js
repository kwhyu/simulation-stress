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

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const results = [];
    for (const scenario of scenarios) {
      const { url, repeats, duration, users, inputField, inputValue, button } = scenario;

      for (let i = 0; i < users; i++) {
        for (let j = 0; j < repeats; j++) {
          const page = await browser.newPage();
          try {
            await page.goto(url);

            if (inputField && inputValue) {
              await page.type(inputField, inputValue);
            }

            if (button) {
              await page.click(button);
            }

            await page.waitForTimeout(duration);
          } catch (error) {
            console.error('Error:', error.message);
          } finally {
            await page.close();
          }
        }
      }
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
