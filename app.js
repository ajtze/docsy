const $=id=>document.getElementById(id);
const editor=$('editor'), paper=$('paper'), preview=$('previewContent');
let zoom=1, deferredInstall=null, saveTimer=null;
const settingsIds=['paperSize','orientation','fontSize','lineSpacing','textColor','pageColor','marginTop','marginRight','marginBottom','marginLeft','alignment','paraGap','headerText','footerText','pageNumbers','watermark','template','accent','printFriendly','fontFamily'];
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2300)}
function safeName(){return ($('docTitle').value.trim()||'document').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'document'}
function getSettings(){const s={};settingsIds.forEach(id=>{const el=$(id);s[id]=el.type==='checkbox'?el.checked:el.value});return s}
function dims(){let map={A4:[210,297],A3:[297,420],A5:[148,210],Letter:[216,279],Legal:[216,356]};let d=map[$('paperSize').value]||[+$('customW').value||210,+$('customH').value||297];if($('orientation').value==='landscape')d.reverse();return d}
function render(){
 const s=getSettings(),[w,h]=dims();
 preview.innerHTML=editor.innerHTML;
 preview.style.fontFamily=$('fontFamily').value;preview.style.fontSize=$('fontSize').value+'pt';preview.style.lineHeight=$('lineSpacing').value;preview.style.color=$('textColor').value;preview.style.textAlign=$('alignment').value;
 preview.querySelectorAll('p').forEach(p=>p.style.marginBottom=$('paraGap').value+'px');
 paper.style.width=(w/25.4*96)+'px';paper.style.minHeight=(h/25.4*96)+'px';paper.style.background=$('printFriendly').checked?'#fff':$('pageColor').value;
 paper.style.padding=`${+$('marginTop').value/25.4*96}px ${+$('marginRight').value/25.4*96}px ${+$('marginBottom').value/25.4*96}px ${+$('marginLeft').value/25.4*96}px`;
 $('previewHeader').textContent=$('headerText').value;$('previewFooter').textContent=$('footerText').value;$('previewWatermark').textContent=$('watermark').value;
 $('previewPageNumber').textContent=$('pageNumbers').value==='none'?'': '1';
 $('pageInfo').textContent=` · ${$('paperSize').value} · ${$('orientation').value}`;
 const text=editor.innerText.trim(), words=text?text.split(/\s+/).length:0;
 $('wordCount').textContent=words+' words';$('charCount').textContent=text.length+' characters';
 const approx=Math.max(1,Math.ceil(text.length/2600));$('pageEstimate').textContent=`${approx} page${approx===1?'':'s'} estimated`;
 $('fontSizeOut').textContent=$('fontSize').value+' pt';$('lineOut').textContent=$('lineSpacing').value;
 paper.style.transform=`scale(${zoom})`;$('zoomLabel').textContent=Math.round(zoom*100)+'%';
 scheduleSave();
}
function scheduleSave(){ $('saveState').textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('docsy-draft',JSON.stringify({html:editor.innerHTML,title:$('docTitle').value,settings:getSettings()}));$('saveState').textContent='Saved on this device'}catch(e){$('saveState').textContent='Not saved'}} ,450)}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function htmlDoc(){const clone=editor.cloneNode(true);return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml($('docTitle').value)}</title><style>body{font-family:${$('fontFamily').value};font-size:${$('fontSize').value}pt;line-height:${$('lineSpacing').value};color:${$('textColor').value};max-width:850px;margin:40px auto;padding:30px}p{margin-bottom:${$('paraGap').value}px}img{max-width:100%}</style></head><body>${clone.innerHTML}</body></html>`}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function exportTxt(){download(new Blob([editor.innerText],{type:'text/plain;charset=utf-8'}),safeName()+'.txt')}
function exportHtml(){download(new Blob([htmlDoc()],{type:'text/html;charset=utf-8'}),safeName()+'.html')}
function exportMd(){let text=editor.innerText;editor.querySelectorAll('h1,h2,h3').forEach(el=>{text=text.replace(el.innerText,`${'#'.repeat(Number(el.tagName[1]))} ${el.innerText}`)});download(new Blob([text],{type:'text/markdown;charset=utf-8'}),safeName()+'.md')}
function exportPdf(){window.print()}
function exportDocx(){
 if(!window.docx){toast('DOCX library is unavailable. Connect to the internet and reload.');return}
 const {Document,Packer,Paragraph,TextRun,HeadingLevel}=window.docx;
 const paras=editor.innerText.split('\n').map(line=>new Paragraph({children:[new TextRun(line)]}));
 const doc=new Document({sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,right:1134,bottom:1134,left:1134}}},children:paras}]});
 Packer.toBlob(doc).then(blob=>download(blob,safeName()+'.docx')).catch(()=>toast('Could not create DOCX.'));
}
function insertHtml(html){editor.focus();document.execCommand('insertHTML',false,html);render()}
document.querySelectorAll('[data-cmd]').forEach(b=>b.addEventListener('click',()=>{editor.focus();document.execCommand(b.dataset.cmd,false,null);render()}));
$('blockStyle').addEventListener('change',e=>{editor.focus();document.execCommand('formatBlock',false,e.target.value);render()});
$('fontFamily').addEventListener('change',()=>{editor.focus();document.execCommand('fontName',false,$('fontFamily').value);render()});
editor.addEventListener('input',render);
settingsIds.forEach(id=>$(id).addEventListener('input',()=>{if(id==='paperSize')$('customSize').hidden=$('paperSize').value!=='Custom';render()}));
$('openFileBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;const name=f.name.toLowerCase();try{let t=await f.text();if(name.endsWith('.html')||name.endsWith('.htm')){const d=new DOMParser().parseFromString(t,'text/html');editor.innerHTML=d.body.innerHTML}else if(name.endsWith('.docx')){toast('DOCX import is not available in this starter version. Try TXT, Markdown or HTML.');return}else{editor.innerText=t} $('docTitle').value=f.name.replace(/\.[^.]+$/,'');render();toast('File opened locally.')}catch(err){toast('Could not read this file.')}e.target.value=''};
$('newDocBtn').onclick=()=>{if(editor.innerText.trim()&&!confirm('Start a new document? Your current draft is saved locally.'))return;editor.innerHTML='<p></p>';$('docTitle').value='Untitled document';render();editor.focus()};
$('insertTable').onclick=()=>insertHtml('<table><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></tbody></table><p></p>');
$('insertImage').onclick=()=>$('imageInput').click();
$('imageInput').onchange=e=>{const f=e.target.files[0];if(!f)return;if(f.size>4*1024*1024){toast('Please choose an image smaller than 4 MB.');return}const r=new FileReader();r.onload=()=>insertHtml(`<img src="${r.result}" alt="Inserted image"><p></p>`);r.readAsDataURL(f);e.target.value=''};
$('insertLink').onclick=()=>{const url=prompt('Enter a link (https://…)');if(url&&/^https?:\/\//i.test(url)){editor.focus();document.execCommand('createLink',false,url);render()}else if(url)toast('Only http and https links are allowed.')};
$('insertSignature').onclick=()=>insertHtml('<p><br><br>____________________________<br>Signature</p>');
$('replaceBtn').onclick=()=>{const find=$('findText').value;if(!find){toast('Enter text to find.');return}const replacement=$('replaceText').value;const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);let count=0;nodes.forEach(n=>{if(n.parentElement.closest('script,style'))return;const v=n.nodeValue;if(v.includes(find)){const parts=v.split(find);count+=parts.length-1;n.nodeValue=parts.join(replacement)}});render();toast(`${count} replacement(s) made.`)};
$('speakBtn').onclick=()=>{if(!('speechSynthesis'in window)){toast('Text-to-speech is not supported in this browser.');return}speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(editor.innerText))};
$('pdfBtn').onclick=exportPdf;$('exportPdfTop').onclick=exportPdf;$('docxBtn').onclick=exportDocx;$('htmlBtn').onclick=exportHtml;$('mdBtn').onclick=exportMd;$('txtBtn').onclick=exportTxt;
$('zoomIn').onclick=()=>{zoom=Math.min(1.3,zoom+.1);render()};$('zoomOut').onclick=()=>{zoom=Math.max(.55,zoom-.1);render()};
$('resetBtn').onclick=()=>{if(!confirm('Reset page settings to defaults?'))return;location.reload()};
$('themeBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('docsy-theme',document.body.classList.contains('dark')?'dark':'light')};
if(localStorage.getItem('docsy-theme')==='dark')document.body.classList.add('dark');
$('closeDialog').onclick=()=>$('infoDialog').close();
function showInfo(title,html){$('dialogTitle').textContent=title;$('dialogBody').innerHTML=html;$('infoDialog').showModal()}
document.querySelectorAll('.footer-links a[href^="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();const key=a.getAttribute('href');if(key==='#privacy')showInfo('Privacy',`<p>DOCSY is designed to process document content in your browser. This starter does not send your document text to a DOCSY server or store it in a cloud account.</p><p>A local draft may be saved in this browser's LocalStorage. Clear it using your browser settings or the Clear document option in a future release. Hosting providers may process ordinary connection logs.</p><p>Third-party fonts and the DOCX library are loaded from external CDNs in this starter and may make network requests.</p>`);if(key==='#about')showInfo('About DOCSY','<p>DOCSY is a simple browser-based document studio for writing, formatting and exporting documents.</p><p>No account is required. Your documents are handled on your device.</p>');if(key==='#help')showInfo('Help','<p>Write or paste content, customize page settings, preview your document and export it. For PDF, choose “Save as PDF” in your browser print dialog.</p><p>DOCX export is supported when the document library has loaded. This starter currently imports TXT, Markdown and HTML files.</p>')});
let promptEvent;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;$('installBtn').hidden=false});
$('installBtn').onclick=async()=>{if(!promptEvent)return;promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;$('installBtn').hidden=true};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
try{const saved=JSON.parse(localStorage.getItem('docsy-draft')||'null');if(saved){editor.innerHTML=saved.html||editor.innerHTML;$('docTitle').value=saved.title||'Untitled document';Object.entries(saved.settings||{}).forEach(([id,v])=>{if($(id)){if($(id).type==='checkbox')$(id).checked=v;else $(id).value=v}})}}catch(e){}
render();
