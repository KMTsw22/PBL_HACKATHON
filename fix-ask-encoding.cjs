const fs = require('fs');
const path = 'src/pages/Ask.tsx';
let s = fs.readFileSync(path, 'utf8');

// placeholder: fix broken string (no closing quote) - match placeholder="... up to newline and value=
s = s.replace(/placeholder="[\s\S]*?\n\s*value=/, 'placeholder="예: 어떤 앱을 만들고 싶다 / 팀원 구해요"\n            value=');

// aria-label
s = s.replace(/aria-label="[^"]*"/, 'aria-label="에이전트에게 보낼 메시지"');

fs.writeFileSync(path, s, 'utf8');
console.log('Done');
