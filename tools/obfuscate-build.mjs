// Build the SHIPPED WebView asset from the readable canonical single-file app.
// - Strips HTML comments (incl. the changelog / IP history).
// - Obfuscates ONLY the app's own inline scripts (the two `(function(){…})()` IIFEs), leaving the
//   already-minified third-party libs (JSZip, lamejs — they start with `/*!`) untouched.
// The canonical ARTiFACTSFX404_vN.html stays readable for development; this output is what Gradle packages.
//
// Usage: node tools/obfuscate-build.mjs [inputHtml] [outputHtml]
//   defaults: highest ARTiFACTSFX404_v*.html  ->  android/app/src/main/assets/index.html
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JavaScriptObfuscator from 'javascript-obfuscator';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function latestCanonical(){
  const files = fs.readdirSync(root).filter(f=>/^ARTiFACTSFX404_v\d+\.html$/.test(f));
  if(!files.length) throw new Error('no ARTiFACTSFX404_v*.html found');
  files.sort((a,b)=> (+a.match(/v(\d+)/)[1]) - (+b.match(/v(\d+)/)[1]));
  return path.join(root, files[files.length-1]);
}

const input  = process.argv[2] ? path.resolve(process.argv[2]) : latestCanonical();
const output = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root,'android/app/src/main/assets/index.html');

let html = fs.readFileSync(input,'utf8');

// 1) drop HTML comments (removes the changelog block and any other <!-- --> notes)
html = html.replace(/<!--[\s\S]*?-->/g, '');

// 2) obfuscate each APP inline <script> (content begins with an IIFE); leave libs (`/*!`) as-is
// Strong profile, bounded by the app's real-time-audio + low-end-device constraint (comportamiento > estructura):
// controlFlowFlattening + stringArray(base64) + wrappers + selfDefending give the anti-decompile teeth;
// deadCodeInjection is kept modest and rc4 avoided so parse/exec stays viable on weak phones.
// Anti-decompile teeth chosen to be CHEAP at runtime (the app is real-time audio and must stay fast on
// low-end phones — comportamiento > estructura): full identifier mangling, base64 string-array with light
// wrapping, string splitting, object-key transform, number-expressions and selfDefending are all low-cost;
// controlFlowFlattening + deadCodeInjection (the expensive-at-startup transforms) are kept LOW so the whole
// IIFE (which runs a lot of setup at load) doesn't balloon parse/exec time. Measured startup stays ~1.5x
// readable instead of ~3.2x at the aggressive setting.
const OBFU = {
  compact:true,
  controlFlowFlattening:true, controlFlowFlatteningThreshold:0.35,
  deadCodeInjection:true, deadCodeInjectionThreshold:0.1,
  numbersToExpressions:true, simplify:true,
  stringArray:true, stringArrayEncoding:['base64'], stringArrayThreshold:0.75,
  stringArrayCallsTransform:true, stringArrayWrappersCount:1, stringArrayWrappersType:'variable',
  splitStrings:true, splitStringsChunkLength:8,
  transformObjectKeys:true, identifierNamesGenerator:'hexadecimal',
  renameGlobals:false,        // keep window.__fx404Back etc. — the native bridge calls them by name
  selfDefending:true, disableConsoleOutput:false, debugProtection:false,
  target:'browser'
};

const parts = html.split(/(<script>|<\/script>)/);
let obfCount=0, libCount=0;
for(let i=0;i<parts.length;i++){
  if(parts[i]==='<script>' && parts[i+2]==='</script>'){
    const code = parts[i+1];
    const t = code.replace(/^\s+/,'');
    if(t.startsWith('(function(') || t.startsWith('(()=>') || t.startsWith('(async')){
      parts[i+1] = JavaScriptObfuscator.obfuscate(code, OBFU).getObfuscatedCode();
      obfCount++;
    } else { libCount++; } // /*! JSZip / lamejs — already minified, leave intact
  }
}
html = parts.join('');

fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, html);
const kb = (n)=> (n/1024).toFixed(0)+'KB';
console.log('input :', path.basename(input), kb(fs.statSync(input).size));
console.log('output:', path.relative(root,output), kb(fs.statSync(output).size));
console.log('scripts obfuscated:', obfCount, '| libs left intact:', libCount);
