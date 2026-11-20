const fs = require('fs');
let c = fs.readFileSync('src\\App.tsx', 'utf8');
const lines = c.split('\n');

// Find line with 'const isMobile = useIsMobile();'
let idx = lines.findIndex(l => l.includes('const isMobile = useIsMobile();'));
if (idx === -1) { console.error('Marker not found'); process.exit(1); }

// NAV_TABS to insert (6 lines)
const navTabsLines = [
  "  const NAV_TABS = [",
  "    { id: 'overview', label: 'Overview', icon: LayoutDashboard },",
  "    { id: 'timetable', label: 'Timetable', icon: Calendar, count: courses.length },",
  "    { id: 'projects', label: 'Vault', icon: FolderGit2 },",
  "    { id: 'notifications', label: 'Priority', icon: Bell },",
  "  ];"
];

// Insert after idx
lines.splice(idx + 1, 0, ...navTabsLines);

const newContent = lines.join('\n');
fs.writeFileSync('src\\App.tsx', newContent);
console.log('Inserted NAV_TABS inside function after isMobile');