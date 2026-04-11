#!/usr/bin/env node
/**
 * Quick diagnostic script for image issues
 * Run: node check-images.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Image Setup...\n');

const checks = [];

// Check 1: OptimizedImage component exists
const optimizedImagePath = path.join(__dirname, 'src/components/OptimizedImage.jsx');
if (fs.existsSync(optimizedImagePath)) {
  console.log('✅ OptimizedImage.jsx found');
  checks.push(true);
} else {
  console.log('❌ OptimizedImage.jsx NOT FOUND at:', optimizedImagePath);
  checks.push(false);
}

// Check 2: imageOptimization utils exist
const utilsPath = path.join(__dirname, 'src/utils/imageOptimization.js');
if (fs.existsSync(utilsPath)) {
  console.log('✅ imageOptimization.js found');
  checks.push(true);
} else {
  console.log('❌ imageOptimization.js NOT FOUND at:', utilsPath);
  checks.push(false);
}

// Check 3: Homelist.jsx modified
const homelistPath = path.join(__dirname, 'src/Component/Home/Homelist.jsx');
if (fs.existsSync(homelistPath)) {
  const content = fs.readFileSync(homelistPath, 'utf8');
  if (content.includes('OptimizedImage')) {
    console.log('✅ Homelist.jsx uses OptimizedImage');
    checks.push(true);
  } else {
    console.log('⚠️  Homelist.jsx exists but NOT using OptimizedImage');
    checks.push(false);
  }
} else {
  console.log('❌ Homelist.jsx NOT FOUND');
  checks.push(false);
}

// Check 4: Placeholder image
const placeholderPath = path.join(__dirname, 'public/placeholder.jpg');
if (fs.existsSync(placeholderPath)) {
  console.log('✅ placeholder.jpg exists');
  checks.push(true);
} else {
  console.log('⚠️  placeholder.jpg NOT FOUND - images might fail without fallback');
  console.log('   Create one or component will use https://via.placeholder.com');
  checks.push(true); // Not critical
}

// Check 5: DEBUG version available
const debugPath = path.join(__dirname, 'src/components/OptimizedImage_DEBUG.jsx');
if (fs.existsSync(debugPath)) {
  console.log('✅ DEBUG version available for troubleshooting');
  checks.push(true);
} else {
  console.log('⚠️  DEBUG version not found (optional)');
  checks.push(true); // Optional
}

// Summary
console.log('\n' + '='.repeat(50));
const passed = checks.filter(Boolean).length;
const total = checks.length;

if (passed === total) {
  console.log('🎉 All checks passed! Setup looks good.');
  console.log('\nNext steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Open browser console (F12)');
  console.log('3. Look for 🖼️ OptimizedImage rendering logs');
  console.log('4. Check Network tab for image requests');
} else {
  console.log(`⚠️  ${total - passed} issues found. See above for details.`);
  console.log('\nTo fix:');
  console.log('1. Make sure all files are created');
  console.log('2. Check file paths are correct');
  console.log('3. Restart dev server: npm run dev');
}

console.log('\n📚 For detailed troubleshooting:');
console.log('   Read: TROUBLESHOOTING_IMAGES.md');

process.exit(passed === total ? 0 : 1);
