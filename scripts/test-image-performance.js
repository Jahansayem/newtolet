/**
 * Image Performance Testing Script
 * Run with: node scripts/test-image-performance.js
 *
 * Measures:
 * - Total transferred bytes (before/after optimization)
 * - Time to first visible images
 * - Cumulative Layout Shift (CLS)
 * - Largest Contentful Paint (LCP)
 */

const puppeteer = require('puppeteer');

const TEST_URL = process.env.TEST_URL || 'http://localhost:5173/propertylist';
const NUM_RUNS = 3;

async function measureImagePerformance() {
  console.log('🚀 Starting Image Performance Test...\n');

  const browser = await puppeteer.launch({ headless: 'new' });
  const results = [];

  for (let i = 0; i < NUM_RUNS; i++) {
    console.log(`📊 Run ${i + 1}/${NUM_RUNS}...`);

    const page = await browser.newPage();

    // Enable Performance API
    await page.evaluateOnNewDocument(() => {
      window.imageMetrics = {
        totalBytes: 0,
        imageCount: 0,
        firstImageTime: null,
        images: [],
      };

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.initiatorType === 'img') {
            window.imageMetrics.imageCount++;
            window.imageMetrics.totalBytes += entry.transferSize;
            window.imageMetrics.images.push({
              url: entry.name,
              bytes: entry.transferSize,
              duration: entry.duration,
            });

            if (!window.imageMetrics.firstImageTime) {
              window.imageMetrics.firstImageTime = entry.responseEnd;
            }
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    });

    // Navigate and wait for images
    await page.goto(TEST_URL, { waitUntil: 'networkidle2' });

    // Wait a bit for lazy images
    await page.waitForTimeout(2000);

    // Get metrics
    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      const cls = performance
        .getEntriesByType('layout-shift')
        .reduce((sum, entry) => sum + entry.value, 0);

      return {
        images: window.imageMetrics,
        webVitals: {
          lcp: performance.getEntriesByType('largest-contentful-paint')[0]?.renderTime || null,
          cls: cls,
          fcp: performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint')?.startTime || null,
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
        },
      };
    });

    results.push(metrics);
    await page.close();
  }

  await browser.close();

  // Calculate averages
  const avgMetrics = {
    totalBytes: average(results.map((r) => r.images.totalBytes)),
    imageCount: average(results.map((r) => r.images.imageCount)),
    firstImageTime: average(results.map((r) => r.images.firstImageTime)),
    lcp: average(results.map((r) => r.webVitals.lcp)),
    cls: average(results.map((r) => r.webVitals.cls)),
    fcp: average(results.map((r) => r.webVitals.fcp)),
  };

  // Print results
  console.log('\n📈 Performance Results (Average):');
  console.log('=====================================');
  console.log(`Total Images Loaded: ${Math.round(avgMetrics.imageCount)}`);
  console.log(`Total Transferred: ${formatBytes(avgMetrics.totalBytes)}`);
  console.log(`Avg per Image: ${formatBytes(avgMetrics.totalBytes / avgMetrics.imageCount)}`);
  console.log(`First Image: ${avgMetrics.firstImageTime.toFixed(0)}ms`);
  console.log(`\n🎯 Web Vitals:`);
  console.log(`LCP (Largest Contentful Paint): ${avgMetrics.lcp.toFixed(0)}ms ${getLCPRating(avgMetrics.lcp)}`);
  console.log(`CLS (Cumulative Layout Shift): ${avgMetrics.cls.toFixed(3)} ${getCLSRating(avgMetrics.cls)}`);
  console.log(`FCP (First Contentful Paint): ${avgMetrics.fcp.toFixed(0)}ms`);

  // Estimate savings
  const unoptimizedEstimate = avgMetrics.imageCount * 500 * 1024; // Est 500KB per image
  const savings = ((unoptimizedEstimate - avgMetrics.totalBytes) / unoptimizedEstimate) * 100;

  console.log(`\n💾 Estimated Bandwidth Savings: ${savings.toFixed(1)}%`);
  console.log(`   (${formatBytes(unoptimizedEstimate)} → ${formatBytes(avgMetrics.totalBytes)})`);

  return avgMetrics;
}

function average(arr) {
  return arr.reduce((sum, val) => sum + (val || 0), 0) / arr.length;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getLCPRating(lcp) {
  if (lcp < 2500) return '✅ Good';
  if (lcp < 4000) return '⚠️ Needs Improvement';
  return '❌ Poor';
}

function getCLSRating(cls) {
  if (cls < 0.1) return '✅ Good';
  if (cls < 0.25) return '⚠️ Needs Improvement';
  return '❌ Poor';
}

// Run test
measureImagePerformance()
  .then(() => {
    console.log('\n✅ Test Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test Failed:', error);
    process.exit(1);
  });
