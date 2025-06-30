const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const FormData = require('form-data');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(express.json());

// Cloudinary config (replace via Render environment variables)
const CLOUDINARY_UPLOAD_URL = process.env.CLOUDINARY_UPLOAD_URL;
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;

// Ensure screenshots folder exists
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir);
}

app.post('/screenshot', async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).send('Missing URL');

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));

    const timestamp = Date.now();
    const filename = `screenshot-${timestamp}.png`;
    const filepath = path.join(screenshotsDir, filename);

    await page.screenshot({ path: filepath, fullPage: true });
    await browser.close();

    // Upload to Cloudinary
    const form = new FormData();
    form.append('file', fs.createReadStream(filepath));
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const cloudinaryResponse = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: form,
    });

    const cloudinaryData = await cloudinaryResponse.json();

    // Delete local screenshot
    fs.unlinkSync(filepath);

    if (cloudinaryData.secure_url) {
      res.json({ imageUrl: cloudinaryData.secure_url });
    } else {
      console.error('Cloudinary upload error:', cloudinaryData);
      res.status(500).send('Cloudinary upload failed');
    }
  } catch (err) {
    console.error('Screenshot or upload failed:', err);
    res.status(500).send('Screenshot failed');
  }
});

app.get('/', (req, res) => {
  res.send('Hello, world!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
