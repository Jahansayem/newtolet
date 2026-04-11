const fs = require('fs');

let content = fs.readFileSync('src/Component/Home/Admin.jsx', 'utf8');

// Split into lines
const lines = content.split('\n');

// Update line 1366 (All)
lines[1365] = '                                        All({properties.length})';
// Update line 1372 (Pending)
lines[1371] = '                                        Pending({properties.filter(p => p.status === \'pending\').length})';
// Update line 1378 (Approved)
lines[1377] = '                                        Approved({properties.filter(p => p.status === \'approved\').length})';
// Update line 1384 (Rejected)
lines[1383] = '                                        Rejected({properties.filter(p => p.status === \'rejected\').length})';

// Join back and write
content = lines.join('\n');
fs.writeFileSync('src/Component/Home/Admin.jsx', content);

console.log('Done! Added property counts to filter buttons.');
console.log('Line 1366: All({properties.length})');
console.log('Line 1372: Pending({properties.filter(p => p.status === \'pending\').length})');
console.log('Line 1378: Approved({properties.filter(p => p.status === \'approved\').length})');
console.log('Line 1384: Rejected({properties.filter(p => p.status === \'rejected\').length})');
