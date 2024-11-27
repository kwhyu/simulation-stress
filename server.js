// const express = require('express');
// const bodyParser = require('body-parser');
// const puppeteer = require('puppeteer');

// const app = express();
// app.use(bodyParser.json());
// app.use(express.static('public'));

// let logs = [];

// // Fungsi untuk menambahkan log
// function addLogEntry(message, type = 'info') {
//   logs.push({
//     timestamp: new Date(),
//     message,
//     type,
//   });
// }

// // API untuk mengambil log
// app.get('/get-logs', (req, res) => {
//   res.json(logs);
// });

// // API untuk menjalankan skenario
// app.post('/run-scenarios', async (req, res) => {
//   const scenarios = req.body.scenarios;

//   if (!scenarios || scenarios.length === 0) {
//     res.status(400).json({ error: 'No scenarios provided.' });
//     return;
//   }

//   const results = [];

//   for (const [index, scenario] of scenarios.entries()) {
//     try {
//       addLogEntry(`Running scenario ${index + 1}...`);

//       const browser = await puppeteer.launch({
//         args: ['--no-sandbox', '--disable-setuid-sandbox'],
//       });

//       const { url, users, repeats, duration, inputField, inputValue, button } =
//         scenario;

//       // Inisialisasi hasil skenario
//       const scenarioResults = {
//         url,
//         totalTests: users * repeats,
//         successCount: 0,
//         errorCount: 0,
//         totalLoadTime: 0,
//         avgLoadTime: 0,
//         successRate: 0,
//         errorRate: 0,
//       };

//       for (let repeatIndex = 0; repeatIndex < repeats; repeatIndex++) {
//         try {
//           // Buat semua pengguna berjalan paralel
//           const userTasks = Array.from({ length: users }).map(async (_, userIndex) => {
//             try {
//               const page = await browser.newPage();
//               const startTime = Date.now();

//               await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 }); // 120 detik
//               const loadTime = Date.now() - startTime;

//               scenarioResults.successCount++;
//               scenarioResults.totalLoadTime += loadTime;

//               addLogEntry(
//                 `Scenario ${index + 1}, User ${userIndex + 1}, Repeat ${repeatIndex + 1}: Success (${loadTime}ms)`,
//                 'success'
//               );

//               // Simulate input if selectors are provided
//               if (inputField && inputValue) {
//                 await page.type(inputField, inputValue);
//                 addLogEntry(
//                   `Scenario ${index + 1}: Typed '${inputValue}' into '${inputField}'`,
//                   'success'
//                 );
//               }

//               // Click button if provided
//               if (button) {
//                 try {
//                   await page.waitForSelector(button, { timeout: 120000 }); // 120 detik
//                   await page.click(button);
//                   addLogEntry(
//                     `Scenario ${index + 1}: Clicked button '${button}'`,
//                     'success'
//                   );
//                 } catch (error) {
//                   scenarioResults.errorCount++;
//                   addLogEntry(
//                     `Scenario ${index + 1}: Failed to click button '${button}' (${error.message})`,
//                     'error'
//                   );
//                 }
//               }

//               await page.close();
//             } catch (error) {
//               scenarioResults.errorCount++;
//               addLogEntry(
//                 `Scenario ${index + 1}, User ${userIndex + 1}, Repeat ${repeatIndex + 1}: Failed (${error.message})`,
//                 'error'
//               );
//             }
//           });

//           // Jalankan semua tugas pengguna secara paralel
//           await Promise.all(userTasks);

//           // Tunggu durasi jika diberikan
//           if (duration) {
//             await new Promise((resolve) => setTimeout(resolve, duration));
//           }
//         } catch (error) {
//           scenarioResults.errorCount++;
//           addLogEntry(
//             `Scenario ${index + 1}, Repeat ${repeatIndex + 1}: Failed (${error.message})`,
//             'error'
//           );
//         }
//       }

//       // Hitung rata-rata waktu muat, tingkat keberhasilan, dan tingkat kesalahan
//       if (scenarioResults.successCount > 0) {
//         scenarioResults.avgLoadTime =
//           scenarioResults.totalLoadTime / scenarioResults.successCount;
//       }
//       scenarioResults.successRate =
//         (scenarioResults.successCount / scenarioResults.totalTests) * 100;
//       scenarioResults.errorRate =
//         (scenarioResults.errorCount / scenarioResults.totalTests) * 100;

//       results.push({
//         scenario: index + 1,
//         status: 'Success',
//         details: scenarioResults,
//       });

//       await browser.close();
//       addLogEntry(`Scenario ${index + 1} completed successfully.`, 'success');
//     } catch (error) {
//       results.push({
//         scenario: index + 1,
//         status: 'Failed',
//         error: error.message,
//       });
//       addLogEntry(`Scenario ${index + 1} failed: ${error.message}`, 'error');
//     }
//   }

//   res.json({ results });
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   addLogEntry(`Server running on port ${PORT}`, 'info');
// });


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
    maxConcurrency: 20, // Maksimal 20 tab aktif secara bersamaan
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
