const fs = require('fs');
const path = 'src/pages/Ask.tsx';
let s = fs.readFileSync(path, 'utf8');

// Context-based replace: match surrounding, replace middle (so we don't need exact broken chars)
s = s.replace(/\/\*\* steps[\s\S]*?총괄 최종 [\s\S]*?\*\//, '/** steps를 카카오톡처럼 말풍선 목록으로 변환. 총괄 말 → (에이전트 생각 중 or 답변) 반복 → 총괄 최종 정리 */');
s = s.replace(/isStreaming\) bubbles\.push\(\{ from: '총괄', isThinking: true, text: '[^']+' \}\)/, "isStreaming) bubbles.push({ from: '총괄', isThinking: true, text: '총괄이 구체적으로 물어보면 에이전트들이 생각하고 답해요..' })");
s = s.replace(/text: `\$\{step\.to\}[^`]+`/, 'text: `${step.to}에게: ${step.requestText}`');
s = s.replace(/from: step\.to, isThinking: true, text: '[^']+'/, "from: step.to, isThinking: true, text: '생각 중..'");
s = s.replace(/(id: 'welcome',\s*type: 'agent',\s*text: )'[^']*'/, "$1'안녕하세요. 저는 네 위 에이전트예요. \"어떤 앱을 만들고 싶다\", \"팀원 구해요\", \"기술 스택 추천해줘\"처럼 말해주시면 네 위 에이전트(총괄 추천·기획·기술)가 함께 도와드릴게요.'");
s = s.replace(/(mb-4">)[^<]+(<\/p>)/, '$1에이전트들이 + 네 위 에이전트 (총괄·기획·기술·컨택)$2');
s = s.replace(/(animationDelay: '300ms' \} \/>\s*<\/span>\s*)[^<\n]+(\s*<\/p>)/g, '$1총괄이 구체적으로 물어보면 에이전트들이 생각하고 답해요..$2');
s = s.replace(/(\{b\.from\}) [^\s<]+트</g, '$1 에이전트<');
s = s.replace(/(text-amber-700 mb-2">)\s*[^\s{]+(\s*\{msg\.contactSendError\})/, '$1연락 자동 발송 실패:$2');
s = s.replace(/\? ' Supabase[^']*014_send_dm_as_user[^']*'/g, "? ' Supabase에 마이그레이션 014_send_dm_as_user.sql 을 적용한 뒤 다시 시도해 주세요.'");
s = s.replace(/\? `[^`]*\$\{msg\.contactSentCount\}[^`]*`/, '? `연락 메시지를 ${msg.contactSentCount}명에게 발송했어요. 채팅 탭에서 확인해 보세요.`');
s = s.replace(/\? '채팅[^']*보세[^']*'/, "? '채팅 탭에서 자동으로 연락해 보세요.'");
s = s.replace(/: '채팅[^']*어[^']*' \}/, ": '채팅 탭에서 발송한 연락을 확인해 보세요.'}");
s = s.replace(/>\s*채팅[^<]*확인[^<]*</g, '>채팅에서 확인하기<');
// Loading bubble text: only the line containing "물어" (avoid replacing {b.text} line)
s = s.replace(/(\n\s{26})[^\n]*물어[^\n]*/, '$1총괄이 구체적으로 물어보면 에이전트들이 생각하고 답해요..');
// 연락 자동 발송 실패
s = s.replace(/(text-amber-700 mb-2">)\s*[\s\S]*?(\s*\{msg\.contactSendError\})/, '$1연락 자동 발송 실패:$2');
// 채팅 탭에서 발송한 연락을... (line index 333 = 1-based line 334)
const lines = s.split('\n');
if (lines[333] && lines[333].includes(": '채팅") && !lines[333].includes('확인해 보세요')) {
  lines[333] = lines[333].replace(/(\s*): '[\s\S]*/, "$1: '채팅 탭에서 발송한 연락을 확인해 보세요.'}");
}
s = lines.join('\n');
// 채팅에서 확인하기 button
s = s.replace(/>\s*채팅[\s\S]*?기\s*</g, '>채팅에서 확인하기<');
// Error message: 에이전트 응답 불러오기 못했어요
s = s.replace(/e\.message : '[^']*못했[^']*'/, "e.message : '에이전트 응답 불러오기 못했어요.'");
// Loading avatar: 총 (총괄)
s = s.replace(/(text-\[#FF9C8F\] text-lg">)[^<]+(<\/span>)/, '$1총$2');
// 연락할 수 있는 사용 정보가 없어요
s = s.replace(/alert\('[^']*용[^']*보가[^']*'\)/, "alert('연락할 수 있는 사용자 정보가 없어요')");
// 메시지 발송 실패
s = s.replace(/메시지 [^\s]+ \S+패/, '메시지 발송 실패');
s = s.replace(/alert\('메시지 [^']*'\)/, "alert('메시지 발송에 실패했어요. 다시 시도해 주세요.')");
// RPC 실패 메시지 (두 문자열)
s = s.replace(/rpcResult\.error \? `[^`]*`/, 'rpcResult.error ? `연락 작업 실패: ${rpcResult.error}`');
s = s.replace(/: '[^']*작[^']*못했[^']*'\)/, ": '연락 작업을 못했어요. 다시 시도해 주세요.')");

fs.writeFileSync(path, s, 'utf8');
console.log('Done');
