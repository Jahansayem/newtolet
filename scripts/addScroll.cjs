const fs = require('fs');

let content = fs.readFileSync('src/Component/Home/Admin.jsx', 'utf8');

// Split into lines
const lines = content.split('\n');

// Update line 1356 - change flex-wrap to flex-col sm:flex-row
lines[1355] = `                            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>`;

// Update line 1361 - add scrollable classes to the button container
lines[1360] = `                                <div className='flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide scroll-smooth w-full sm:w-auto touch-pan-x'>
                                    <style>{\`
                                        .scrollbar-hide {-ms-overflow-style: none; scrollbar-width: none;}
                                        .scrollbar-hide::-webkit-scrollbar {display: none;}
                                    \`}</style>`;

// Join back and write
content = lines.join('\n');
fs.writeFileSync('src/Component/Home/Admin.jsx', content);

console.log('Done! Added mobile responsive touch scroll for filter buttons.');
