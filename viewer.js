let mediaManifest={},mediaByFile=new Map(),thumbObserver;
const fullLoads=new Map();
function initMedia(manifest){
 mediaManifest=manifest;
 for(const value of Object.values(manifest))for(const kind of ['full','preview','mobile','thumb'])mediaByFile.set(value[kind].split('/').pop(),value);
}
function mediaAsset(key,kind='preview'){
 const entry=mediaManifest[key];if(!entry)return key||'';
 if(kind==='reference')kind='mobile';
 if(kind==='preview'&&matchMedia('(max-width:900px)').matches)kind='mobile';
 return entry[kind];
}
function promoteImage(img){
 if(!img?.getAttribute('src'))return;
 const expected=img.getAttribute('src'),entry=mediaByFile.get(expected.split('/').pop());
 if(!entry||expected===entry.full||img.dataset.loadingFull===entry.full)return;
 img.dataset.loadingFull=entry.full;
 let promise=fullLoads.get(entry.full);
 if(!promise){
  promise=new Promise((resolve,reject)=>{const next=new Image();next.decoding='async';next.onload=()=>next.decode().then(()=>resolve(next)).catch(()=>resolve(next));next.onerror=reject;next.src=entry.full;});
  fullLoads.set(entry.full,promise);
  if(fullLoads.size>8)fullLoads.delete(fullLoads.keys().next().value);
 }
 promise.then(()=>{if(img.getAttribute('src')===expected){img.src=entry.full;img.dataset.original='true';}}).catch(()=>{fullLoads.delete(entry.full);}).finally(()=>{delete img.dataset.loadingFull;});
}
function observeThumbs(){
 thumbObserver?.disconnect();
 thumbObserver=new IntersectionObserver(entries=>{for(const {isIntersecting,target} of entries)if(isIntersecting){target.src=target.dataset.src;delete target.dataset.src;thumbObserver.unobserve(target);}},{root:document.querySelector('#list'),rootMargin:'100px'});
 for(const img of document.querySelectorAll('#list img[data-src]'))thumbObserver.observe(img);
}

// Keep the existing select values/events, while drawing consistent accessible menus.
const dropdowns=new Map();
let openedDropdown=null;
function closeDropdown(restoreFocus=false){
 if(!openedDropdown)return;
 const current=openedDropdown;openedDropdown=null;
 current.menu.hidden=true;current.trigger.setAttribute('aria-expanded','false');
 if(restoreFocus)current.trigger.focus();
}
function enhanceDropdowns(){
 for(const select of document.querySelectorAll('select')){
  if(dropdowns.has(select))continue;
  const wrap=document.createElement('div'),trigger=document.createElement('button'),menu=document.createElement('div');
  wrap.className='dropdown';trigger.type='button';trigger.className='dropdown-trigger';
  trigger.id=select.id+'-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  menu.id=select.id+'-menu';menu.className='dropdown-menu';menu.setAttribute('role','listbox');
  menu.setAttribute('aria-labelledby',trigger.id);menu.hidden=true;trigger.setAttribute('aria-controls',menu.id);
  select.before(wrap);wrap.append(select,trigger);select.hidden=true;document.body.append(menu);
  const state={select,wrap,trigger,menu};dropdowns.set(select,state);
  function sync(){
   trigger.textContent=select.selectedOptions[0]?.textContent||'请选择';
   trigger.setAttribute('aria-label',(select.getAttribute('aria-label')||({round:'测试记录',room:'场景筛选',grade:'效果筛选',comparison:'左侧对比图'}[select.id]))+'：'+trigger.textContent);
   trigger.disabled=select.disabled||!select.options.length;
   wrap.hidden=select.id==='round';
   if(openedDropdown===state)closeDropdown();
  }
  function show(last=false){
   closeDropdown();sync();if(trigger.disabled)return;
   menu.replaceChildren();
   for(const option of select.options){
    const button=document.createElement('button');button.type='button';button.className='dropdown-option';
    button.textContent=option.textContent;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.selected));button.disabled=option.disabled;
    button.onclick=()=>{select.value=option.value;closeDropdown();select.dispatchEvent(new Event('change',{bubbles:true}));sync();trigger.focus();};menu.append(button);
   }
   const rect=trigger.getBoundingClientRect(),width=Math.max(rect.width,select.id==='round'?250:select.id==='comparison'?220:154);
   menu.style.width=Math.min(width,innerWidth-16)+'px';menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-width-8))+'px';
   const below=innerHeight-rect.bottom-12,above=rect.top-12,up=below<240&&above>below;
   menu.style.maxHeight=Math.min(330,Math.max(80,up?above:below))+'px';
   menu.style.top=up?'auto':rect.bottom+6+'px';menu.style.bottom=up?innerHeight-rect.top+6+'px':'auto';
   menu.hidden=false;trigger.setAttribute('aria-expanded','true');openedDropdown=state;
   const enabled=[...menu.querySelectorAll('button:not(:disabled)')];
   (last?enabled.at(-1):menu.querySelector('[aria-selected="true"]')||enabled[0])?.focus();
  }
  trigger.onclick=()=>openedDropdown===state?closeDropdown():show();
  trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();show(e.key==='End'||e.key==='ArrowUp');}};
  menu.onkeydown=e=>{
   const options=[...menu.querySelectorAll('button:not(:disabled)')],index=options.indexOf(document.activeElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const next=e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next]?.focus();}
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDropdown(true);}
   if(e.key==='Tab')closeDropdown();
  };
  select.addEventListener('change',sync);
  new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true});
  sync();state.sync=sync;
 }
 for(const state of dropdowns.values())state.sync();
}
document.addEventListener('pointerdown',e=>{if(openedDropdown&&!openedDropdown.wrap.contains(e.target)&&!openedDropdown.menu.contains(e.target))closeDropdown();});
addEventListener('resize',()=>closeDropdown());
document.addEventListener('scroll',e=>{if(openedDropdown&&!openedDropdown.menu.contains(e.target))closeDropdown();},true);

const $=s=>document.querySelector(s),asset=(p,kind='preview')=>mediaAsset(p,kind);let payload,stage=new URLSearchParams(location.search).get('stage')||localStorage.getItem('night-stage')||'ab',roundId=new URLSearchParams(location.search).get('round')||localStorage.getItem('night-round')||'',selected=new URLSearchParams(location.search).get('case')||localStorage.getItem('night-case')||'MIX001',items=[],round,mode='after',scale=1,tx=0,ty=0,split=50,gesture=null,raf;
if(!new URLSearchParams(location.search).has('stage')&&!localStorage.getItem('night-overall-b-introduced')){if(['product','material'].includes(stage)){stage='sequential';roundId='';}localStorage.setItem('night-overall-b-introduced','1');}
function transform(){$('#leftLabel').hidden=mode==='after';$('.image-label.right').hidden=mode==='before';for(const el of [$('#before'),$('#after')])el.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;$('#zoom').textContent=Math.round(scale*100)+'%';$('#rightView').style.clipPath=mode==='before'?'inset(0 100% 0 0)':mode==='after'?'none':`inset(0 0 0 ${split}%)`;$('#split').style.left=split+'%';$('#split').hidden=mode!=='compare';$('#split').setAttribute('aria-valuenow',Math.round(split));if(scale>1.05){if(mode!=='after')promoteImage($('#before'));if(mode!=='before')promoteImage($('#after'));}}
function reset(){scale=1;tx=ty=0;split=50;transform()}
function showModal(src,label){$('#large').src=src;$('#modalTitle').textContent=label;$('#modal').hidden=false;promoteImage($('#large'));}
function applyTechnicalRecoveries(){
 for(const r of payload.rounds)for(const c of r.items)if(!c.result&&c.review){c.historicalNonVisualReview=c.review;c.review=null;}

 for(const full of payload.rounds.filter(r=>r.full))for(const item of full.items){
  if(item.result||!['failed','input_blocked'].includes(item.status))continue;
  const candidates=payload.rounds.filter(r=>r.stage===full.stage&&!r.full&&(r.technicalRetry||r.userRequestedRetry)).flatMap(r=>r.items.map(c=>({...c,recoveryRound:r.id,upstreamCompletion:r.upstreamCompletion&&r.sourceFullRound===full.root}))).filter(c=>c.id===item.id&&c.result&&c.prompt===item.prompt&&(JSON.stringify(c.snapshot.inputHashes)===JSON.stringify(item.snapshot.inputHashes)||(c.upstreamCompletion&&['MIX027','MIX072'].includes(c.id)&&full.stage==='material'&&item.status==='input_blocked'))).sort((a,b)=>(a.snapshot.completedAt||'').localeCompare(b.snapshot.completedAt||''));
  if(!candidates.length)continue;
  const recovery=candidates[0];item.originalFailedRequest={...item.snapshot};item.images=recovery.images;item.result=recovery.result;item.status=recovery.status;item.durationMs=recovery.durationMs;item.review=recovery.review;item.snapshot={...recovery.snapshot,technicalRecoveryOf:item.originalFailedRequest.jobId,completionOfOriginalInput:item.originalFailedRequest};item.technicalRecoveryRound=recovery.recoveryRound;
 }
}
function applyHumanReviews(){
 for(const r of payload.rounds.filter(r=>r.stage==='product'))for(const c of r.items){
  const human=payload.productHumanReviews?.reviews?.[c.id];
  if(human&&c.result&&human.jobId===c.snapshot.jobId){c.aiReview=c.aiReview||c.review;c.previousReview=c.review;c.review={...human};}
 }
}
function applyUserInputCorrections(){
 const full=payload.rounds.find(r=>r.id==='材质_全量复测_v4'),correction=payload.rounds.find(r=>r.id==='material-user-corrected-MIX056-20261028');
 const old=full?.items.find(c=>c.id==='MIX056'),fresh=correction?.items.find(c=>c.id==='MIX056');
 if(!old||!fresh?.result)return;
 old.originalIncorrectInputTest={images:old.images,result:old.result,prompt:old.prompt,snapshot:old.snapshot,review:old.review};
 Object.assign(old,{images:fresh.images,result:fresh.result,prompt:fresh.prompt,snapshot:fresh.snapshot,review:fresh.review,aiReview:fresh.aiReview||fresh.review,status:fresh.status,durationMs:fresh.durationMs,userInputCorrectionRound:correction.id});
 delete old.annotationCorrection;
 full.userInputCorrectionCount=1;full.statisticsPolicy='当前展示含用户修正输入重测，非原v4同一输入完整回归';
}
function applyNightstandCorrection058(){
 const corrections=[['材质_全量复测_v4','material-nightstands-MIX058-20261028'],['mixed-concise-20261028','mixed-nightstands-MIX058-20261028']];
 for(const [baseId,fixId] of corrections){
  const base=payload.rounds.find(r=>r.id===baseId),fix=payload.rounds.find(r=>r.id===fixId);
  const old=base?.items.find(c=>c.id==='MIX058'),fresh=fix?.items.find(c=>c.id==='MIX058');
  if(!old||!fresh)continue;
  const history={images:old.images,result:old.result,prompt:old.prompt,snapshot:old.snapshot,status:old.status};
  Object.assign(old,structuredClone(fresh),{previousInputIssue:history,userInputCorrectionRound:fixId});
  old.snapshot={...old.snapshot,scope:'两侧床头柜的木质柜体、台面及抽屉面板',inputCorrectionOf:history};
  delete old.inputIssueReason;delete old.annotationCorrection;
 }
 payload.rounds=payload.rounds.filter(r=>!corrections.some(([,id])=>r.id===id));
}
function applyMaterialHumanReviews(){
 for(const r of payload.rounds.filter(r=>r.stage==='material'))for(const c of r.items){
  const human=MATERIAL_HUMAN_REVIEWS.reviews[c.id];
  if(human&&c.result&&human.jobId===c.snapshot.jobId){c.aiReview=c.aiReview||c.review;c.previousReview=c.review;c.review={...human};}
 }
}
function applySequentialOverall(){
 const product=payload.rounds.find(r=>r.stage==='product'),material=payload.rounds.find(r=>r.stage==='material');
 if(!product||!material)return;
 const entries=product.items.map(p=>{
  const m=material.items.find(c=>c.id===p.id),frozen=SCHEME_B_OVERALL_REVIEW.reviews[p.id];
  const productMatches=frozen&&(p.snapshot.jobId??null)===frozen.product.jobId&&(p.review?.grade??null)===frozen.product.grade;
  const materialMatches=frozen&&m&&(m.snapshot.jobId??null)===frozen.material.jobId&&(m.review?.grade??null)===frozen.material.grade;
  const matches=productMatches&&(frozen.failureStage==='product'||materialMatches);
  const review=matches&&frozen.grade?structuredClone(frozen):null;
  const references=[...p.images.slice(1),...(m?.images.slice(1)||[])].filter((im,i,all)=>all.findIndex(x=>x.path===im.path)===i);
  return {...p,result:m?.result||null,status:m?.status||'queued',images:[p.images[0],...references],review,aiReview:review,
   overallEvaluation:true,overallDecision:matches?frozen:null,componentReviews:{product:p.review,material:m?.review},
   prompt:'【第一步：成品替换】\n'+p.prompt+'\n\n【第二步：材质替换】\n'+(m?.prompt||'未提交'),
   snapshot:{caseId:p.id,product:p.snapshot,material:m?.snapshot,overallReview:matches?frozen:null,policy:SCHEME_B_OVERALL_REVIEW.policy}};
 });
 payload.rounds.push({id:'scheme-b-overall-current',stage:'sequential',label:'方案B：分步替换模式',full:true,overallEvaluation:true,items:entries,evaluationSource:SCHEME_B_OVERALL_REVIEW.evidenceScope});
}
function updateVisualCounts(){for(const r of payload.rounds){const v=r.items.filter(c=>c.result&&c.review&&['可用','基本可用','基本不可用','不可用'].includes(c.review.grade));r.reviewed=v.length;r.passed=v.filter(c=>c.review.passed===true).length;r.pending=r.items.filter(c=>c.review?.grade==='待定').length;r.statisticsPolicy=r.overallEvaluation?(r.evaluationPolicy||SCHEME_B_OVERALL_REVIEW.policy):'仅真实结果且四档已定档样本计效果，待定/接口/输入问题单列';}}
function setStepFiltersExpanded(expanded){
 const panel=$('#stepViews');
 panel.style.setProperty('--step-filter-width',Math.ceil(panel.firstElementChild.getBoundingClientRect().width)+'px');
 panel.inert=!expanded;panel.setAttribute('aria-hidden',String(!expanded));
 panel.classList.toggle('expanded',expanded);
 $('#stages [data-scheme="B"]').setAttribute('aria-expanded',String(expanded));
}
addEventListener('resize',()=>setStepFiltersExpanded(document.body.dataset.scheme==='B'));
function renderSchemeBRates(entries=[['sequential','方案B整体通过率'],['product','成品通过率'],['material','材质通过率']]){
 const host=$('#summary');host.replaceChildren();
 for(const [key,label] of entries){
  const source=payload.rounds.find(r=>r.stage===key),total=source?.reviewed||0,passed=source?.passed||0;
  const stat=document.createElement('span'),name=document.createElement('span'),value=document.createElement('strong');
  stat.className='rate-stat';name.className='rate-label';name.textContent=label;value.className='rate-value';
  value.textContent=total?(Math.round(passed*1000/total)/10).toFixed(1)+'%':'—';
  stat.title=label+'：'+passed+'/'+total+'（可用＋基本可用 / 已定档有效结果）'+(key==='mixed'?'；80组用户人工评估':key==='sequential'?'；人工复核优先，其余保留原整体档位':'；用户已评优先，其余保留原档位');
  stat.append(name,value);host.append(stat);
 }
}
function render(){document.body.dataset.stage=stage;const scheme=stage==='ab'?'AB':stage==='mixed'?'A':'B';document.body.dataset.scheme=scheme;setStepFiltersExpanded(scheme==='B');for(const b of $('#stepViews').querySelectorAll('[data-stage]')){b.classList.toggle('active',b.dataset.stage===stage);b.setAttribute('aria-pressed',String(b.dataset.stage===stage));}round=payload.rounds.find(r=>r.id===roundId);if(!round||round.stage!==stage){round=payload.rounds.filter(r=>r.stage===stage&&r.full).at(-1)||payload.rounds.filter(r=>r.stage===stage).at(-1);roundId=round?.id}const rr=payload.rounds.filter(r=>r.stage===stage);$('#round').innerHTML=rr.map(r=>`<option value="${r.id}">${r.label}</option>`).join('');$('#round').value=roundId||'';const st=payload.progress[stage]?.status||'待开始';const visual=round?.items.filter(c=>c.result&&c.review&&['可用','基本可用','基本不可用','不可用'].includes(c.review.grade))||[],passed=visual.filter(c=>c.review.passed).length;$('#summary').textContent=round?`出图 ${round.items.filter(c=>c.result).length}/${round.items.length} · 效果已评 ${visual.length} · 通过 ${passed}/${visual.length}${visual.length?'（'+(passed/visual.length*100).toFixed(1)+'%）':''} · 接口未出图 ${round.items.filter(c=>!c.result&&c.status==='failed').length} · 输入问题 ${round.items.filter(c=>c.status==='input_blocked').length}`:({material:'等待成品阶段通过后开始',mixed:'等待成品、材质阶段通过后开始'}[stage]||st);if(round?.independentExperiment){$('#summary').textContent+=' · 独立混合测试';}else if(stage!=='product'&&payload.progress.product?.structureReassessmentRequired&&round){$('#summary').textContent+=(stage==='product'?' · 旧口径，待结构≥80%复核':' · 上游成品待结构复核')}if(['product','material'].includes(stage)&&round){const humanCount=round.items.filter(c=>c.result&&c.review?.reviewer==='用户人工评估').length;$('#summary').textContent+=` · 人工复核 ${humanCount} · 其余保留原档位`;}if(round?.pending)$('#summary').textContent+=` · 待定 ${round.pending}`;if(round?.userInputCorrectionCount)$('#summary').textContent+=' · 含1组输入修正重测';if(scheme==='B')renderSchemeBRates();if(scheme==='A')renderSchemeBRates([['mixed','方案A通过率']]);if(stage==='ab')renderSchemeBRates([['mixed','方案A通过率'],['sequential','方案B通过率']]);const q=$('#search').value.toLowerCase(),room=$('#room').value,g=$('#grade').value;items=(round?.items||[]).filter(c=>(!room||c.sceneType===room)&&(!q||`${c.id} ${c.category} ${c.sceneName}`.toLowerCase().includes(q))&&matchesCaseGrade(c,g));if(!items.some(c=>c.id===selected))selected=items[0]?.id;$('#list').replaceChildren();for(const c of items){const b=document.createElement('div');b.className='sample'+(c.id===selected?' active':'');b.dataset.id=c.id;const im=document.createElement('img');im.loading='lazy';im.decoding='async';im.width=88;im.height=66;im.dataset.src=asset(c.images[0].path,'thumb');const t=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small'),gr=document.createElement('div');strong.textContent=c.id;small.textContent=c.mode+' · '+c.category;gr.className='grade'+(c.review?.grade==='待定'?' pending':c.result&&c.review&&c.review.passed===false?' bad':'');gr.textContent=(c.result?c.review?.grade:null)||({completed:'待初评',failed:'请求失败',queued:'待提交',input_blocked:'输入问题'}[c.status]||'生成中');if(stage==='ab')renderABListGrades(gr,c);t.append(strong,small,gr);b.append(im,t);b.onclick=()=>{selected=c.id;render()};$('#list').append(b)}display();localStorage.setItem('night-stage',stage);for(const b of $('#stages').querySelectorAll('[data-scheme]')){b.classList.toggle('active',b.dataset.scheme===scheme);b.setAttribute('aria-pressed',String(b.dataset.scheme===scheme));}$('#summary').title=scheme==='B'?'':$('#summary').textContent;localStorage.setItem('night-round',roundId||'');localStorage.setItem('night-case',selected||'');enhanceDropdowns();observeThumbs()}
function renderAIReview(c){
 const host=$('#aiReview');host.replaceChildren();
 const add=(text,className='')=>{const p=document.createElement('p');p.className=className;p.textContent=text;host.append(p);};
 if(!c.result){add(c.status==='input_blocked'?(c.inputIssueReason||'输入缺少明确可操作的表面，本组没有生成结果，暂不评价效果。'):c.status==='failed'?'本次接口未返回结果，暂不评价画面效果。':'结果尚未生成，出图后再检查款式、作用范围和材质。');return;}
 const ai=c.aiReview||((c.review?.reviewer||'').startsWith('AI')?c.review:null);
 if(!ai?.note){add('这张结果尚未完成 AI 逐图细评，暂不填写问题结论。');return;}
 // Existing notes belong to the actual displayed job, never to an unrelated historical image.
 add(ai.note);
 const issues=(ai.issues||[]).filter(Boolean);
 if(issues.length&&!issues.every(issue=>ai.note.includes(issue)))add('关注点：'+issues.join('、')+'。');
 if(c.review?.reviewer==='用户人工评估'&&ai.grade!==c.review.grade){
  add('以上为既有 AI 记录，与当前人工档位有差异，尚待复核；最终档位以人工初评为准。','ai-review-source');
 }
}
const ORIGINAL_SCENE_IMAGES={"MIX001":"media/088ec6b7489a548804454a5a","MIX002":"media/75e145e5cded555c281d19a4","MIX003":"media/8183759c88fa0c95913d85fc","MIX004":"media/91c98f2a6e38e841af68104b","MIX005":"media/91c98f2a6e38e841af68104b","MIX006":"media/91c98f2a6e38e841af68104b","MIX007":"media/aad87cd6c4a626c92b5a792c","MIX008":"media/aad87cd6c4a626c92b5a792c","MIX009":"media/aad87cd6c4a626c92b5a792c","MIX010":"media/f56aaba3ea35152f8fd8f182","MIX011":"media/f56aaba3ea35152f8fd8f182","MIX012":"media/f56aaba3ea35152f8fd8f182","MIX013":"media/9e43019d4dbc3d50125e29bc","MIX014":"media/9e43019d4dbc3d50125e29bc","MIX015":"media/9e43019d4dbc3d50125e29bc","MIX016":"media/7dddfe3dc567bb766049f8ba","MIX017":"media/7dddfe3dc567bb766049f8ba","MIX018":"media/da45b561744e801ed33a1a0c","MIX019":"media/da45b561744e801ed33a1a0c","MIX020":"media/b6d6facc9e06d3829e24f817","MIX021":"media/2969aeea88d33f304027fd4f","MIX022":"media/36b4b56c6f8de4b26af1a322","MIX023":"media/36b4b56c6f8de4b26af1a322","MIX024":"media/e0bfe2afd2730d9081afdb9d","MIX025":"media/65f871ba3e66ee5e6eae8c4d","MIX026":"media/65f871ba3e66ee5e6eae8c4d","MIX027":"media/df93958da8159151fc4514fc","MIX028":"media/df93958da8159151fc4514fc","MIX029":"media/254ab2d2c288c6f22692c9ec","MIX030":"media/254ab2d2c288c6f22692c9ec","MIX031":"media/8b92a20cbf273844d098164b","MIX032":"media/8b92a20cbf273844d098164b","MIX033":"media/4cd9977d953de90432207e23","MIX034":"media/4cd9977d953de90432207e23","MIX035":"media/5f8a272275d23b3baaff55f0","MIX036":"media/c657f24579cf2cac97907732","MIX037":"media/a370936c9c92aed729b25478","MIX038":"media/21b2e1b893d5af7105c9b46a","MIX039":"media/241680affaf83ee431c118db","MIX040":"media/241680affaf83ee431c118db","MIX041":"media/e7b4791362f96536cf0d0b9a","MIX042":"media/e7b4791362f96536cf0d0b9a","MIX043":"media/e48efb7a8d363df3d7a07c84","MIX044":"media/e48efb7a8d363df3d7a07c84","MIX045":"media/ae07f6035f142ab13b2439a6","MIX046":"media/ae07f6035f142ab13b2439a6","MIX047":"media/76eeba6e547b44cf20440a0f","MIX048":"media/76eeba6e547b44cf20440a0f","MIX049":"media/4fff4e9923b794807db862cb","MIX050":"media/609a6d2471cebdac71fff2c8","MIX051":"media/264d8dfe574101f993b84824","MIX052":"media/264d8dfe574101f993b84824","MIX053":"media/910dfd4acf8726063c6db3d9","MIX054":"media/910dfd4acf8726063c6db3d9","MIX055":"media/910dfd4acf8726063c6db3d9","MIX056":"media/e0ed0076bfb1495ac49d58c2","MIX057":"media/d8cb6d01c2a2e18685359d04","MIX058":"media/d8cb6d01c2a2e18685359d04","MIX059":"media/a623f3ef6d0319da01fcde2c","MIX060":"media/a623f3ef6d0319da01fcde2c","MIX061":"media/a623f3ef6d0319da01fcde2c","MIX062":"media/7e7df707ef3060a6d93614f6","MIX063":"media/1158c9664987be8cd712b7f1","MIX064":"media/1158c9664987be8cd712b7f1","MIX065":"media/462aaf97427f348c5bdeab26","MIX066":"media/462aaf97427f348c5bdeab26","MIX067":"media/7f34e9309a011d0344eb46c8","MIX068":"media/7f34e9309a011d0344eb46c8","MIX069":"media/53a8f1e5b5bca2d6bbadcdb4","MIX070":"media/9790b9817b9a680f361ee0bf","MIX071":"media/9790b9817b9a680f361ee0bf","MIX072":"media/27fb7da7634448241acfd6da","MIX073":"media/27fb7da7634448241acfd6da","MIX074":"media/379c572a89b6231339b42934","MIX075":"media/379c572a89b6231339b42934","MIX076":"media/379c572a89b6231339b42934","MIX077":"media/379c572a89b6231339b42934","MIX078":"media/9078f3aab62e5d794ecb53a5","MIX079":"media/9078f3aab62e5d794ecb53a5","MIX080":"media/85b642de97f0be3378097451"};
function renderReferences(c){
 const host=$('#references');host.replaceChildren();
 const productCase=payload.rounds.find(r=>r.stage==='product')?.items.find(item=>item.id===c.id);
 const materialCase=payload.rounds.find(r=>r.stage==='material')?.items.find(item=>item.id===c.id);
 const original=originalInputPath(c);
 const product=productCase?.images.find(im=>im.role==='productOriginal')||c.images.find(im=>['productOriginal','productTagged'].includes(im.role));
 const material=c.images.find(im=>im.role==='materialOriginal')||materialCase?.images.find(im=>im.role==='materialOriginal');
 function figure(path,label,className){
  const fig=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');
  fig.className=className;img.src=asset(path,'reference');img.alt=label;caption.textContent=label;
  img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','放大查看'+label);
  const open=()=>showModal(img.src,label);img.onclick=open;img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
  fig.append(img,caption);return fig;
 }
 if(original){const scene=figure(original,'原图','reference-scene');scene.title=stage==='material'?'材质替换前的实际成品结果':'替换前的原始场景';host.append(scene);}
 const pair=document.createElement('div');pair.className='reference-pair';
 if(product)pair.append(figure(product.path,'产品参考图','reference-product'));
 if(material)pair.append(figure(material.path,'材质参考图','reference-material'));
 if(pair.children.length)host.append(pair);
}
function display(){if(stage==='ab'){displayABComparison();return;}$('#reviewTitle').textContent='人工初评';const c=items.find(c=>c.id===selected);$('#references').replaceChildren();if(!c){$('#title').textContent='暂无可查看样本';$('#before').removeAttribute('src');$('#after').removeAttribute('src');$('#empty').textContent=round?'当前筛选无样本':'该阶段尚未开始';$('#review').textContent='';$('#prompt').textContent='';$('#snapshot').textContent='';$('#aiReview').replaceChildren();return}$('#empty').textContent=c.result?'':(c.status==='failed'?'本次请求失败，暂无结果图':c.status==='input_blocked'?(c.inputIssueReason||'缺少明确可换材区域，本组未提交请求'):c.status==='queued'?'本组尚未提交':'结果生成中');$('#title').textContent=c.id+' · '+c.mode+c.category+(c.allProducts?' · 全部产品':'')+(stage==='sequential'?' · 整体效果':'');$('#position').textContent=(items.indexOf(c)+1)+' / '+items.length;$('#after').src=c.result?asset(c.result):asset(c.images[0].path);renderReferences(c);$('#review').replaceChildren();const b=document.createElement('b');b.textContent=c.result?(c.review?.grade||'待初评'):(c.status==='failed'?'接口失败，效果待评':c.status==='input_blocked'?'输入问题，未出图':'待出图');if(c.result&&c.review&&c.review.passed===false)b.style.color='#bd433c';b.className='evaluation-tag'+(c.review?.grade==='待定'?' pending':c.result&&c.review&&c.review.passed===false?' bad':'');$('#review').append(b);$('#reviewTitle').textContent='人工初评';if(c.overallDecision){const reason=document.createElement('p');reason.className='gate-reason';reason.textContent=({product:'未通过：第一关 · 成品替换',material:'未通过：第二关 · 材质替换',passed:'成品关、材质关均通过',input:'输入问题 · 暂不评价整体效果',manual:'人工整体评估'}[c.overallDecision.failureStage]||'待复核');$('#review').append(reason);}renderAIReview(c);$('#prompt').textContent=c.prompt;$('#snapshot').textContent=JSON.stringify(c.snapshot,null,2);updateComparisonImage(c);reset()}
async function load(){try{const [r,m]=await Promise.all([fetch('data.json'),fetch('media.json')]);if(!r.ok||!m.ok)throw Error('资源读取失败');payload=await r.json();initMedia(await m.json());render()}catch(e){$('#summary').textContent='加载失败，请刷新重试';console.error(e)}}
function switchStage(next){if(!payload)return;closeDropdown();stage=next;roundId='';mode='after';for(const b of document.querySelectorAll('[data-view]')){b.classList.toggle('active',b.dataset.view===mode);b.setAttribute('aria-pressed',String(b.dataset.view===mode));}render();const url=new URL(location.href);url.searchParams.set('stage',stage);url.searchParams.delete('round');url.searchParams.set('case',selected||'MIX001');history.replaceState(null,'',url);$('#list .active')?.scrollIntoView({block:'nearest'});}$('#stages').onclick=e=>{const button=e.target.closest('button[data-scheme]');if(button)switchStage(button.dataset.scheme==='AB'?'ab':button.dataset.scheme==='A'?'mixed':'sequential');};$('#stepViews').onclick=e=>{const button=e.target.closest('button[data-stage]');if(button)switchStage(button.dataset.stage);};$('#round').onchange=e=>{roundId=e.target.value;render()};for(const id of ['search','room','grade'])$('#'+id).addEventListener(id==='search'?'input':'change',render);function move(n){if(!items.length)return;selected=items[(items.findIndex(c=>c.id===selected)+n+items.length)%items.length].id;render();$('#list .active')?.scrollIntoView({block:'nearest'})}$('#prev').onclick=()=>move(-1);$('#next').onclick=()=>move(1);$('#reset').onclick=reset;for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{mode=b.dataset.view;for(const x of document.querySelectorAll('[data-view]')){x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));}updateComparisonImage();transform()};$('#copy').onclick=()=>navigator.clipboard.writeText($('#prompt').textContent);$('#close').onclick=()=>$('#modal').hidden=true;$('#modal').onclick=e=>{if(e.target===$('#modal'))$('#modal').hidden=true};document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.closest('.dropdown,.dropdown-menu'))return;if(e.key==='Escape')$('#modal').hidden=true;if($('#modal').hidden&&e.key==='ArrowRight')move(1);if($('#modal').hidden&&e.key==='ArrowLeft')move(-1)});const canvas=$('#canvas');canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;gesture={kind:e.target.closest('#split')?'split':'pan',x:e.clientX,y:e.clientY,tx,ty};canvas.setPointerCapture(e.pointerId);e.preventDefault()});canvas.addEventListener('pointermove',e=>{if(!gesture)return;const g=gesture,rect=canvas.getBoundingClientRect();if(g.kind==='split')split=Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100));else{tx=g.tx+e.clientX-g.x;ty=g.ty+e.clientY-g.y}if(!raf)raf=requestAnimationFrame(()=>{raf=null;transform()})});canvas.addEventListener('pointerup',()=>gesture=null);canvas.addEventListener('pointercancel',()=>gesture=null);canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,ns=Math.max(1,Math.min(8,scale*Math.exp(-e.deltaY*.0015))),k=ns/scale;tx=x-(x-tx)*k;ty=y-(y-ty)*k;scale=ns;transform()},{passive:false});canvas.addEventListener('dblclick',reset);$('#split').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.stopPropagation();e.preventDefault();split=Math.max(0,Math.min(100,split+(e.key==='ArrowRight'?2:-2)));transform()}});load();

function originalInputPath(c){
 if(stage==='material')return payload.rounds.find(r=>r.stage==='product')?.items.find(item=>item.id===c.id)?.result;
 return ORIGINAL_SCENE_IMAGES[c.id];
}
function updateComparisonImage(c=items.find(item=>item.id===selected)){
 if(!c||mode==='after')return;
 const tagged=c.annotationCorrection?.correctedImage||c.images[0].path;
 const path=mode==='before'?tagged:(originalInputPath(c)||tagged);
 const src=asset(path);if($('#before').getAttribute('src')!==src)$('#before').src=src;
 $('#leftLabel').textContent=mode==='before'?'标签区域':'原图';
}
$('#large').addEventListener('click',e=>{const el=e.currentTarget,r=el.getBoundingClientRect(),k=Math.min(r.width/el.naturalWidth,r.height/el.naturalHeight),w=el.naturalWidth*k,h=el.naturalHeight*k;if(e.clientX<r.left+(r.width-w)/2||e.clientX>r.right-(r.width-w)/2||e.clientY<r.top+(r.height-h)/2||e.clientY>r.bottom-(r.height-h)/2)$('#modal').hidden=true});



function applyABHumanReviews(){
 for(const [key,stageName] of [['A','mixed'],['B','sequential']]){
  const r=payload.rounds.find(r=>r.stage===stageName);if(!r)continue;r.evaluationPolicy=AB_HUMAN_REVIEWS.policy;r.evaluationSource=key==='A'?'80组用户人工评估':'24组本轮用户整体评估，其余56组保留原整体档位';
  for(const c of r.items){
   const human=AB_HUMAN_REVIEWS.reviews[key]?.[c.id];if(!human||!c.result)continue;
   const matches=key==='A'?human.jobId===c.snapshot.jobId:human.productJobId===c.snapshot.product?.jobId&&human.materialJobId===c.snapshot.material?.jobId;
   if(!matches)continue;
   c.previousReview=c.review;c.aiReview=c.aiReview||c.review;c.review=structuredClone(human);
   c.snapshot={...c.snapshot,humanReview:structuredClone(human)};
   if(key==='B'){c.overallDecision={...c.overallDecision,grade:human.grade,passed:human.passed,reviewer:human.reviewer,failureStage:'manual'};c.userOverallReview=true;}
  }
 }
}
function applyABComparison(){
 const a=payload.rounds.find(r=>r.stage==='mixed'),b=payload.rounds.find(r=>r.stage==='sequential');
 if(!a||!b)return;
 const entries=b.items.map(right=>{
  const left=a.items.find(c=>c.id===right.id);
  return {...right,comparison:{a:left||null,b:right},review:null,aiReview:null,overallDecision:null,
   status:left?.result&&right.result?'completed':'queued',
   prompt:'【方案A：混合模式】\n'+(left?.prompt||'未提交')+'\n\n【方案B：分步替换模式】\n'+right.prompt,
   snapshot:{caseId:right.id,schemeA:left?.snapshot,schemeB:right.snapshot}};
 });
 payload.rounds.push({id:'scheme-ab-comparison-current',stage:'ab',label:'方案A/B对比',full:true,items:entries});
}
function matchesCaseGrade(c,g){
 if(!g)return true;
 if(stage==='ab')return [c.comparison?.a,c.comparison?.b].some(item=>item?.result&&item.review?.grade===g);
 return g==='failed'?(c.result&&c.review&&c.review.passed===false):g==='technical'?(!c.result&&c.status==='failed'):g==='blocked'?c.status==='input_blocked':g==='pending'?(c.result&&!c.review):(c.result&&c.review?.grade===g);
}
function comparisonGrade(c){return c?.result?(c.review?.grade||'待初评'):'未出图';}
function reviewTone(c){return !c?.review?'pending':c.review.passed===false?'bad':'';}
function renderABListGrades(host,c){
 host.className='grade ab-list-grades';host.replaceChildren();
 for(const [key,label] of [['a','A'],['b','B']]){const item=c.comparison?.[key],span=document.createElement('span');span.textContent=label+'：'+comparisonGrade(item);span.className=reviewTone(item);host.append(span);}
}
let activeABPaint=()=>{};
addEventListener('resize',()=>{if(stage==='ab')activeABPaint();});
function schemeBStageSummary(item){
 const product=item?.componentReviews?.product,material=item?.componentReviews?.material;
 if(!product?.grade)return '成品关待评估。';
 const productPass=['可用','基本可用'].includes(product.grade);
 if(!productPass)return '成品关为'+product.grade+'，第一关未通过。';
 const first='成品关为'+product.grade+'，已通过；';
 if(!material?.grade)return first+'材质关待评估。';
 return first+'材质关为'+material.grade+(['可用','基本可用'].includes(material.grade)?'，已通过。':'，第二关未通过。');
}
function displayABComparison(){
 const c=items.find(item=>item.id===selected),host=$('#abCompare');host.replaceChildren();$('#abReviews').replaceChildren();$('#references').replaceChildren();
 $('#title').textContent=c?c.id+' · '+c.mode+c.category+' · 方案A/B对比':'暂无可查看样本';$('#position').textContent=c?(items.indexOf(c)+1)+' / '+items.length:'';
 $('#prompt').textContent=c?.prompt||'';$('#snapshot').textContent=c?JSON.stringify(c.snapshot,null,2):'';
 if(!c){activeABPaint=()=>{};return;}
 renderReferences(c);
 const linked={scale:1,x:0,y:0,views:[]};
 for(const [key,label] of [['a','方案A：混合模式'],['b','方案B：分步替换模式']]){
  const item=c.comparison[key],pane=document.createElement('section'),head=document.createElement('div'),title=document.createElement('h3'),zoom=document.createElement('span'),view=document.createElement('div');
  pane.className='ab-pane';pane.dataset.scheme=key;head.className='ab-pane-head';title.textContent=label;zoom.className='ab-zoom-value';zoom.textContent='100%';
  view.className='ab-image-viewport';view.tabIndex=0;view.setAttribute('role','group');view.setAttribute('aria-label',c.id+' '+label+'最终结果，两图同步滚轮缩放、拖动，双击一起复位');view.title='两图同步缩放与拖动 · 双击一起复位';
  if(item?.result){const img=document.createElement('img');img.src=asset(item.result);img.alt=c.id+' '+label+'最终结果';img.draggable=false;img.dataset.jobId=(key==='b'?item.snapshot.material?.jobId:item.snapshot.jobId)||'';view.append(img);bindABViewport(view,img,zoom,linked);}else{const empty=document.createElement('span');empty.className='ab-missing';empty.textContent='本方案尚未出图';view.append(empty);}
  head.append(title,zoom);pane.append(head,view);host.append(pane);
  const entry=document.createElement('div'),heading=document.createElement('h4'),grade=document.createElement('span'),note=document.createElement('p');entry.className='ab-review-entry';heading.textContent=label;grade.className='ab-review-tag '+reviewTone(item);grade.textContent=comparisonGrade(item);entry.append(heading,grade);if(key==='b'){note.textContent=schemeBStageSummary(item);entry.append(note);}$('#abReviews').append(entry);
 }
 activeABPaint=()=>paintABViewports(linked);activeABPaint();
}
function paintABViewports(state){
 state.x=Math.max(1-state.scale,Math.min(0,state.x));state.y=Math.max(1-state.scale,Math.min(0,state.y));
 for(const {view,img,label} of state.views){
  const rect=view.getBoundingClientRect(),x=state.x*rect.width,y=state.y*rect.height;
  img.style.transform=`translate(${x}px,${y}px) scale(${state.scale})`;if(state.scale>1.05)promoteImage(img);
  view.dataset.scale=String(state.scale);view.dataset.x=String(x);view.dataset.y=String(y);
  label.textContent=Math.round(state.scale*100)+'%';
 }
}
function bindABViewport(view,img,label,state){
 state.views.push({view,img,label});let drag=null;
 function zoomTo(next,clientX,clientY){
  const rect=view.getBoundingClientRect(),x=clientX===undefined ? 0.5 : (clientX-rect.left)/rect.width,y=clientY===undefined ? 0.5 : (clientY-rect.top)/rect.height;
  const scale=Math.max(1,Math.min(8,next)),ratio=scale/state.scale;
  state.x=x-(x-state.x)*ratio;state.y=y-(y-state.y)*ratio;state.scale=scale;
  if(scale===1)state.x=state.y=0;paintABViewports(state);
 }
 view.addEventListener('wheel',e=>{e.preventDefault();zoomTo(state.scale*Math.exp(-e.deltaY*.0015),e.clientX,e.clientY);},{passive:false});
 view.addEventListener('pointerdown',e=>{if(e.button!==0)return;view.focus({preventScroll:true});const rect=view.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,tx:state.x,ty:state.y,width:rect.width,height:rect.height};view.setPointerCapture(e.pointerId);e.preventDefault();for(const item of state.views)item.view.classList.add('dragging');});
 view.addEventListener('pointermove',e=>{if(!drag)return;state.x=drag.tx+(e.clientX-drag.x)/drag.width;state.y=drag.ty+(e.clientY-drag.y)/drag.height;paintABViewports(state);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(event,()=>{drag=null;for(const item of state.views)item.view.classList.remove('dragging');});
 view.addEventListener('dblclick',()=>zoomTo(1));
 view.addEventListener('keydown',e=>{if(['+','=','-','0','Home'].includes(e.key)){e.preventDefault();e.stopPropagation();zoomTo(e.key==='0'||e.key==='Home'?1:state.scale*(e.key==='-'?1/1.4:1.4));}});
}