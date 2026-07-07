// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let session      = null;
const BASE_PATH  = '/home/student/workspace';
let currentPath  = BASE_PATH;
let navHistory   = [BASE_PATH];
let navIndex     = 0;
let viewMode     = 'grid';
let currentFiles = [];
let selectedItem = null;
let clipboard    = { type:null, items:[], srcPath:'' };
let undoStack    = [];
let redoStack    = [];
let pendingCreate = null;

// ═══════════════════════════════════════════════
//  FILE TYPES & ICONS
// ═══════════════════════════════════════════════
const TYPES = {
    '.py':{label:'Python',color:'#3b82f6'},'.cpp':{label:'C++',color:'#8b5cf6'},
    '.c':{label:'C',color:'#10b981'},'.h':{label:'Header',color:'#f59e0b'},
    '.hpp':{label:'C++ Header',color:'#a78bfa'},'.js':{label:'JavaScript',color:'#eab308'},
    '.ts':{label:'TypeScript',color:'#38bdf8'},'.html':{label:'HTML',color:'#f97316'},
    '.css':{label:'CSS',color:'#06b6d4'},'.json':{label:'JSON',color:'#84cc16'},
    '.xml':{label:'XML',color:'#a3e635'},'.csv':{label:'CSV',color:'#a3e635'},
    '.txt':{label:'Text',color:'#94a3b8'},'.md':{label:'Markdown',color:'#38bdf8'},
    '.sh':{label:'Shell',color:'#22c55e'},'.bash':{label:'Bash',color:'#22c55e'},
    '.out':{label:'Binary',color:'#ef4444'},'.exe':{label:'Executable',color:'#ef4444'},
    'dir':{label:'Folder',color:'#facc15'},'default':{label:'File',color:'#6b7280'}
};

const FILE_TEMPLATES = {
    '.py':'# Python Script\n\ndef main():\n    print("Hello!")\n\nif __name__ == "__main__":\n    main()\n',
    '.cpp':'#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello!" << endl;\n    return 0;\n}\n',
    '.c':'#include <stdio.h>\n\nint main() {\n    printf("Hello!\\n");\n    return 0;\n}\n',
    '.h':'#pragma once\n\n// Header file\n','.hpp':'#pragma once\n\n// C++ Header\n',
    '.txt':'','.md':'# Title\n\nContent here.\n','.json':'{\n  \n}\n',
    '.sh':'#!/bin/bash\n\necho "Hello!"\n','.js':'"use strict";\n\nconsole.log("Hello!");\n',
    '.ts':'const msg: string = "Hello!";\nconsole.log(msg);\n',
    '.css':'/* Stylesheet */\nbody { margin:0; }\n',
    '.html':'<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Page</title>\n</head>\n<body>\n\n</body>\n</html>\n',
    '.xml':'<?xml version="1.0" encoding="UTF-8"?>\n<root>\n\n</root>\n',
    '.csv':'col1,col2,col3\nval1,val2,val3\n'
};

const CODE_EXTS = new Set(['.py','.cpp','.c','.h','.hpp','.js','.ts','.sh','.bash','.html','.css','.json','.xml','.md','.txt','.csv']);

function getMeta(name,isDir){ if(isDir)return TYPES['dir']; return TYPES['.'+( name.split('.').pop()||'').toLowerCase()]||TYPES['default']; }

function getIcon(name,isDir,sz=46){
    const {color:c}=getMeta(name,isDir);
    const ext=isDir?'dir':('.'+( name.split('.').pop()||'').toLowerCase());
    if(isDir)return`<svg width="${sz}" height="${sz}" viewBox="0 0 48 48" fill="none"><path d="M6 14a4 4 0 0 1 4-4h8l4 5h16a4 4 0 0 1 4 4v17a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V14z" fill="${c}" fill-opacity=".7"/><path d="M6 23h36" stroke="${c}" stroke-width="1.5" stroke-opacity=".35"/></svg>`;
    const isCode=['.py','.cpp','.c','.h','.hpp','.js','.ts','.sh','.bash','.html','.css'].includes(ext);
    if(isCode)return`<svg width="${sz}" height="${sz}" viewBox="0 0 48 48" fill="none"><rect x="7" y="4" width="34" height="40" rx="4" fill="${c}" fill-opacity=".1" stroke="${c}" stroke-opacity=".38" stroke-width="1.5"/><path d="M16 20l-6 4 6 4" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 20l6 4-6 4" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 16l-8 16" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-opacity=".5"/></svg>`;
    const isData=['.json','.xml','.csv'].includes(ext);
    if(isData)return`<svg width="${sz}" height="${sz}" viewBox="0 0 48 48" fill="none"><rect x="7" y="4" width="34" height="40" rx="4" fill="${c}" fill-opacity=".1" stroke="${c}" stroke-opacity=".38" stroke-width="1.5"/><path d="M14 14h8M14 22h20M14 29h16M14 36h12" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`;
    const isText=['.txt','.md'].includes(ext);
    if(isText)return`<svg width="${sz}" height="${sz}" viewBox="0 0 48 48" fill="none"><rect x="7" y="4" width="34" height="40" rx="4" fill="${c}" fill-opacity=".09" stroke="${c}" stroke-opacity=".32" stroke-width="1.5"/><path d="M14 16h20M14 22h20M14 28h14M14 34h10" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`;
    return`<svg width="${sz}" height="${sz}" viewBox="0 0 48 48" fill="none"><path d="M10 6a4 4 0 0 1 4-4h18l12 12v28a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V6z" fill="${c}" fill-opacity=".09" stroke="${c}" stroke-opacity=".32" stroke-width="1.5"/><path d="M32 2v12h12" stroke="${c}" stroke-opacity=".38" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ═══════════════════════════════════════════════
//  CUSTOM DIALOGS
// ═══════════════════════════════════════════════
function showConfirm(title, fileName, message, okLabel='Delete', danger=true) {
    return new Promise(resolve => {
        const ov = document.createElement('div');
        ov.className = 'xmodal-overlay open';
        const icon = danger
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        const okClass = danger ? 'xbtn-danger-ok' : 'xbtn-confirm';
        ov.innerHTML = `<div class="xmodal-box xmodal-sm">
            <div class="xconfirm-icon">${icon}</div>
            <p class="xconfirm-title">${esc(title)}</p>
            ${fileName ? `<p class="xconfirm-fname">"${esc(fileName)}"</p>` : ''}
            ${message  ? `<p class="xconfirm-msg">${esc(message)}</p>` : ''}
            <div class="xmodal-actions">
                <button class="xbtn-cancel" id="dlg-no">Cancel</button>
                <button class="${okClass}" id="dlg-yes">${esc(okLabel)}</button>
            </div></div>`;
        document.body.appendChild(ov);
        const cleanup = val => { ov.remove(); resolve(val); };
        ov.querySelector('#dlg-no').addEventListener('click',  ()=>cleanup(false));
        ov.querySelector('#dlg-yes').addEventListener('click', ()=>cleanup(true));
        ov.addEventListener('click', e=>{ if(e.target===ov) cleanup(false); });
        ov.querySelector('#dlg-yes').focus();
    });
}

function showPrompt(title, defaultVal='', placeholder='') {
    return new Promise(resolve => {
        const ov = document.createElement('div');
        ov.className = 'xmodal-overlay open';
        ov.innerHTML = `<div class="xmodal-box xmodal-sm">
            <p class="xconfirm-title">${esc(title)}</p>
            <input type="text" class="xmodal-input" id="dlg-input" value="${esc(defaultVal)}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false">
            <div class="xmodal-actions" style="margin-top:16px;">
                <button class="xbtn-cancel" id="dlg-no">Cancel</button>
                <button class="xbtn-confirm" id="dlg-ok">OK</button>
            </div></div>`;
        document.body.appendChild(ov);
        const inp = ov.querySelector('#dlg-input');
        setTimeout(()=>{ inp.focus(); inp.select(); }, 40);
        const cleanup = val => { ov.remove(); resolve(val); };
        ov.querySelector('#dlg-no').addEventListener('click',  ()=>cleanup(null));
        ov.querySelector('#dlg-ok').addEventListener('click',  ()=>cleanup(inp.value.trim()||null));
        inp.addEventListener('keydown', e=>{
            if(e.key==='Enter'){e.preventDefault();cleanup(inp.value.trim()||null);}
            if(e.key==='Escape') cleanup(null);
        });
        ov.addEventListener('click', e=>{ if(e.target===ov) cleanup(null); });
    });
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', ()=>{
    session = requireAuth();
    if(!session) return;
    navigate(BASE_PATH, false);
    initToolbar(); initContextMenu(); initCreateModal(); initUploadModal(); initKeyboard();
    document.addEventListener('click', e=>{
        if(!e.target.closest('.file-item')&&!e.target.closest('.list-item')&&
           !e.target.closest('.exp-details-pane')&&!e.target.closest('.ctx-menu')&&
           !e.target.closest('.xnew-wrap')) clearSelection();
        if(!e.target.closest('.ctx-menu'))  document.getElementById('ctx-menu').classList.remove('open');
        if(!e.target.closest('.xnew-wrap')) closeDd();
    });
});

// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════
async function navigate(path, addToHistory=true){
    if(addToHistory){navHistory=navHistory.slice(0,navIndex+1);navHistory.push(path);navIndex=navHistory.length-1;}
    currentPath=path; selectedItem=null; hideDetails(); updateNavBtns(); renderBreadcrumbs();
    await loadDirectory();
}
function updateNavBtns(){
    document.getElementById('btn-back').disabled    = navIndex<=0;
    document.getElementById('btn-forward').disabled = navIndex>=navHistory.length-1;
}
function renderBreadcrumbs(){
    const el=document.getElementById('breadcrumbs'); el.innerHTML='';
    const parts=['workspace',...currentPath.replace(BASE_PATH,'').split('/').filter(Boolean)];
    let build=BASE_PATH;
    parts.forEach((p,i)=>{
        if(i>0) build+='/'+p;
        const isLast=i===parts.length-1;
        const s=document.createElement('span'); s.className='crumb'+(isLast?' active':''); s.textContent=p;
        if(!isLast){const cap=build;s.onclick=()=>navigate(cap);}
        el.appendChild(s);
        if(!isLast){const sep=document.createElement('span');sep.className='crumb-sep';sep.textContent='/';el.appendChild(sep);}
    });
}

// ═══════════════════════════════════════════════
//  LOAD & RENDER
// ═══════════════════════════════════════════════
async function loadDirectory(){
    const ct=document.getElementById('file-content'); ct.innerHTML='<div class="exp-loading">Loading...</div>';
    try{
        const res=await fetch(`/api/fs/list?userId=${session.userId}&path=${encodeURIComponent(currentPath)}`);
        const data=await res.json();
        if(data.success){currentFiles=data.files||[];renderFiles();}
        else ct.innerHTML=`<div class="exp-empty"><p>Error: ${data.error||'Cannot read folder'}</p></div>`;
    }catch{ct.innerHTML='<div class="exp-empty"><p>Connection error.</p></div>';}
}

function renderFiles(){
    const ct=document.getElementById('file-content'); ct.innerHTML='';
    const sorted=[...currentFiles].sort((a,b)=>{if(a.isDir&&!b.isDir)return -1;if(!a.isDir&&b.isDir)return 1;return a.name.localeCompare(b.name);});
    if(!sorted.length){ct.innerHTML=`<div class="exp-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><p>This folder is empty</p></div>`;return;}
    if(viewMode==='grid'){const g=document.createElement('div');g.className='file-grid';sorted.forEach(f=>g.appendChild(makeGridItem(f)));ct.appendChild(g);}
    else{const l=document.createElement('div');l.className='file-list';const h=document.createElement('div');h.className='list-header';h.innerHTML='<span>Name</span><span>Type</span><span>Modified</span><span style="text-align:right">Size</span>';l.appendChild(h);sorted.forEach(f=>l.appendChild(makeListItem(f)));ct.appendChild(l);}
}

function makeGridItem(f){
    const item=document.createElement('div');
    item.className='file-item'+(clipboard.type==='cut'&&clipboard.items.includes(f.name)?' cut-item':'');
    item.dataset.name=f.name;
    const meta=getMeta(f.name,f.isDir);
    item.title=`${f.name}\n${meta.label}${!f.isDir&&f.size?'\nSize: '+fmtSize(f.size):''}${f.mtime?'\nModified: '+fmtDate(f.mtime):''}`;
    item.innerHTML=`<div class="fi-icon">${getIcon(f.name,f.isDir)}</div><span class="file-name-label">${esc(f.name)}</span><span class="file-type-label">${meta.label}</span>`;
    item.addEventListener('click',       e=>{e.stopPropagation();selectItem(f,item);});
    item.addEventListener('dblclick',    e=>{e.stopPropagation();openItem(f);});
    item.addEventListener('contextmenu', e=>{e.preventDefault();selectItem(f,item);showCtxMenu(e,f);});
    return item;
}

function makeListItem(f){
    const row=document.createElement('div');
    row.className='list-item'+(clipboard.type==='cut'&&clipboard.items.includes(f.name)?' cut-item':'');
    row.dataset.name=f.name;
    const meta=getMeta(f.name,f.isDir);
    row.innerHTML=`<div class="list-name">${getIcon(f.name,f.isDir,20)}<span title="${esc(f.name)}">${esc(f.name)}</span></div><span class="list-type" style="color:${meta.color}">${meta.label}</span><span class="list-date">${f.mtime?fmtDate(f.mtime):'—'}</span><span class="list-size">${f.isDir?'—':fmtSize(f.size||0)}</span>`;
    row.addEventListener('click',       e=>{e.stopPropagation();selectItem(f,row);});
    row.addEventListener('dblclick',    e=>{e.stopPropagation();openItem(f);});
    row.addEventListener('contextmenu', e=>{e.preventDefault();selectItem(f,row);showCtxMenu(e,f);});
    return row;
}

// ═══════════════════════════════════════════════
//  SELECTION + BUTTON HIGHLIGHT
// ═══════════════════════════════════════════════
// Butoane care se activeaza cand e fisier selectat
const SEL_BTNS = ['btn-cut','btn-copy','btn-rename','btn-delete'];

function selectItem(f,el){
    document.querySelectorAll('.file-item.selected,.list-item.selected').forEach(x=>x.classList.remove('selected'));
    if(selectedItem?.name===f.name){selectedItem=null;hideDetails();updateTb();return;}
    el.classList.add('selected'); selectedItem=f; updateTb(); showDetails(f);
}

function clearSelection(){
    selectedItem=null;
    document.querySelectorAll('.file-item.selected,.list-item.selected').forEach(x=>x.classList.remove('selected'));
    updateTb(); hideDetails();
}

function updateTb(){
    const has=!!selectedItem;

    SEL_BTNS.forEach(id=>{
        const el=document.getElementById(id);
        el.disabled=!has;
        // Albastru cand activ, normal cand inactiv
        el.classList.toggle('xbtn-sel', has);
    });

    // Paste si undo/redo
    document.getElementById('btn-paste').disabled=!clipboard.items.length;
    document.getElementById('btn-undo').disabled=!undoStack.length;
    document.getElementById('btn-redo').disabled=!redoStack.length;
}

// ═══════════════════════════════════════════════
//  DETAILS PANEL
// ═══════════════════════════════════════════════
async function showDetails(f){
    const pane=document.getElementById('details-pane'); pane.style.display='flex';
    const meta=getMeta(f.name,f.isDir);
    document.getElementById('det-icon').innerHTML=getIcon(f.name,f.isDir,56);
    document.getElementById('det-name').textContent=f.name;
    const badge=document.getElementById('det-type');
    badge.textContent=meta.label;
    badge.style.cssText=`background:${meta.color}1a;color:${meta.color};border:1px solid ${meta.color}40;`;
    document.getElementById('det-size').textContent=f.isDir?'—':fmtSize(f.size||0);
    document.getElementById('det-modified').textContent=f.mtime?fmtDate(f.mtime):'—';
    document.getElementById('det-location').textContent=currentPath.replace('/home/student/','~/');
    const openBtn=document.getElementById('det-btn-open');
    const canOpen=!f.isDir&&['.py','.cpp','.c'].some(e=>f.name.endsWith(e));
    openBtn.style.display=canOpen?'block':'none';
    openBtn.onclick=()=>openItem(f);
    document.getElementById('det-btn-rename').onclick=()=>startRename(f);
    document.getElementById('det-btn-delete').onclick=()=>deleteSelected();
    document.getElementById('det-close').onclick=()=>clearSelection();
    const ext='.'+( f.name.split('.').pop()||'').toLowerCase();
    const prevWrap=document.getElementById('det-preview-wrap');
    if(!f.isDir&&CODE_EXTS.has(ext)){
        prevWrap.style.display='flex';
        document.getElementById('det-preview').textContent='Loading...';
        try{
            const res=await fetch('/api/fs/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:session.userId,filePath:`${currentPath}/${f.name}`})});
            const data=await res.json();
            document.getElementById('det-preview').textContent=data.success&&data.content?data.content.slice(0,2000):'(Empty file)';
        }catch{document.getElementById('det-preview').textContent='(Preview unavailable)';}
    }else prevWrap.style.display='none';
}
function hideDetails(){document.getElementById('details-pane').style.display='none';}

function openItem(f){
    if(f.isDir){navigate(`${currentPath}/${f.name}`);return;}
    const ext=f.name.split('.').pop().toLowerCase();
    const lang=ext==='py'?'python':(ext==='cpp'?'cpp':(ext==='c'?'c':null));
    const proj=currentPath.replace(BASE_PATH+'/','').split('/')[0]||'';
    if(lang&&proj) window.location.href=`workspace.html?lang=${lang}&name=${encodeURIComponent(proj)}`;
    else showToast('Open supported from project source files only.','error');
}

// ═══════════════════════════════════════════════
//  TOOLBAR
// ═══════════════════════════════════════════════
function initToolbar(){
    document.getElementById('btn-back').addEventListener('click',    ()=>{if(navIndex>0){navIndex--;navigate(navHistory[navIndex],false);}});
    document.getElementById('btn-forward').addEventListener('click', ()=>{if(navIndex<navHistory.length-1){navIndex++;navigate(navHistory[navIndex],false);}});
    document.getElementById('btn-cut').addEventListener('click',    cutSelected);
    document.getElementById('btn-copy').addEventListener('click',   copySelected);
    document.getElementById('btn-paste').addEventListener('click',  pasteClipboard);
    document.getElementById('btn-rename').addEventListener('click', ()=>{if(selectedItem)startRename(selectedItem);});
    document.getElementById('btn-delete').addEventListener('click', deleteSelected);
    document.getElementById('btn-undo').addEventListener('click',   performUndo);
    document.getElementById('btn-redo').addEventListener('click',   performRedo);
    document.getElementById('btn-refresh').addEventListener('click', loadDirectory);
    document.getElementById('btn-view-grid').addEventListener('click',()=>{viewMode='grid';document.getElementById('btn-view-grid').classList.add('xbtn-active');document.getElementById('btn-view-list').classList.remove('xbtn-active');renderFiles();});
    document.getElementById('btn-view-list').addEventListener('click',()=>{viewMode='list';document.getElementById('btn-view-list').classList.add('xbtn-active');document.getElementById('btn-view-grid').classList.remove('xbtn-active');renderFiles();});
    document.getElementById('btn-upload').addEventListener('click', openUploadModal);
    document.getElementById('btn-create').addEventListener('click', e=>{
        e.stopPropagation();
        const dd=document.getElementById('create-dropdown');
        if(dd.classList.contains('open')){closeDd();return;}
        const rect=e.currentTarget.getBoundingClientRect();
        dd.style.top=(rect.bottom+6)+'px'; dd.style.right=(window.innerWidth-rect.right)+'px'; dd.style.left='auto';
        dd.classList.add('open');
    });
    document.querySelectorAll('.cd-item').forEach(item=>{
        item.addEventListener('click', e=>{e.stopPropagation();closeDd();openCreateModal(item.dataset.action,item.dataset.ext||'');});
    });
    updateTb();
}
function closeDd(){document.getElementById('create-dropdown').classList.remove('open');}

// ═══════════════════════════════════════════════
//  CUT / COPY / PASTE
// ═══════════════════════════════════════════════
function cutSelected(){if(!selectedItem)return;clipboard={type:'cut',items:[selectedItem.name],srcPath:currentPath};updateTb();renderFiles();showToast(`Cut: "${selectedItem.name}"`);}
function copySelected(){if(!selectedItem)return;clipboard={type:'copy',items:[selectedItem.name],srcPath:currentPath};updateTb();showToast(`Copied: "${selectedItem.name}"`);}
async function pasteClipboard(){
    if(!clipboard.items.length)return;
    const name=clipboard.items[0],srcFull=`${clipboard.srcPath}/${name}`;
    if(clipboard.type==='cut'){
        const dst=`${currentPath}/${name}`;
        if(srcFull===dst){showToast('Already in this folder.','error');return;}
        const r=await api('/api/fs/rename',{userId:session.userId,oldPath:srcFull,newPath:dst});
        if(r?.success){recordA({type:'move',oldPath:dst,newPath:srcFull});clipboard={type:null,items:[],srcPath:''};await loadDirectory();showToast(`Moved: "${name}"`,'success');}
        else showToast('Move failed.','error');
    }else{
        const names=currentFiles.map(f=>f.name); let dst=`${currentPath}/${name}`;
        if(names.includes(name)){const d=name.lastIndexOf('.');const b=d>0?name.slice(0,d):name;const e=d>0?name.slice(d):'';dst=`${currentPath}/${b}_copy${e}`;}
        const r=await api('/api/fs/copy',{userId:session.userId,sourcePath:srcFull,destPath:dst});
        if(r?.success){recordA({type:'copy',path:dst});await loadDirectory();showToast(`Copied as "${dst.split('/').pop()}"`,'success');}
        else showToast('Copy failed.','error');
    }
}

// ═══════════════════════════════════════════════
//  DELETE — cu dialog custom
// ═══════════════════════════════════════════════
async function deleteSelected(){
    if(!selectedItem) return;
    const f=selectedItem;
    const ok=await showConfirm(
        f.isDir ? 'Delete Folder' : 'Delete File',
        f.name,
        f.isDir ? 'This folder and all its contents will be permanently deleted.' : 'This file will be permanently deleted.',
        'Delete', true
    );
    if(!ok) return;
    const r=await api('/api/fs/delete',{userId:session.userId,path:`${currentPath}/${f.name}`});
    if(r?.success){clearSelection();await loadDirectory();showToast('Deleted.');}
    else showToast('Delete failed: '+(r?.error||''),'error');
}

// ═══════════════════════════════════════════════
//  RENAME — inline cu fallback dialog custom
// ═══════════════════════════════════════════════
function startRename(f){
    hideDetails();
    let el=null;
    document.querySelectorAll(viewMode==='grid'?'.file-item':'.list-item').forEach(e=>{if(e.dataset.name===f.name)el=e;});
    if(!el){doRename(f);return;}
    const ns=el.querySelector('.file-name-label, .list-name span');
    if(!ns){doRename(f);return;}
    const hasExt=!f.isDir&&f.name.includes('.');
    const ext=hasExt?'.'+f.name.split('.').pop():'';
    const base=hasExt?f.name.slice(0,-(ext.length)):f.name;
    const inp=document.createElement('input');
    inp.type='text';inp.className='rename-input';inp.value=base;
    ns.replaceWith(inp);inp.focus();inp.select();
    let done=false;
    async function commit(){
        if(done)return;done=true;
        const nb=inp.value.trim();const newName=(nb||base)+ext;
        inp.replaceWith(ns);
        if(!nb||newName===f.name)return;
        const r=await api('/api/fs/rename',{userId:session.userId,oldPath:`${currentPath}/${f.name}`,newPath:`${currentPath}/${newName}`});
        if(r?.success){recordA({type:'rename',oldPath:`${currentPath}/${newName}`,newPath:`${currentPath}/${f.name}`});await loadDirectory();showToast(`Renamed to "${newName}"`,'success');}
        else showToast('Rename failed.','error');
    }
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();}if(e.key==='Escape'){done=true;inp.replaceWith(ns);}});
    inp.addEventListener('blur',commit);
}

async function doRename(f){
    const hasExt=!f.isDir&&f.name.includes('.');
    const ext=hasExt?'.'+f.name.split('.').pop():'';
    const base=hasExt?f.name.slice(0,-(ext.length)):f.name;
    const nb=await showPrompt(`Rename "${f.name}"`,base,'New name');
    if(!nb||nb===base) return;
    const newName=nb+ext;
    const r=await api('/api/fs/rename',{userId:session.userId,oldPath:`${currentPath}/${f.name}`,newPath:`${currentPath}/${newName}`});
    if(r?.success){recordA({type:'rename',oldPath:`${currentPath}/${newName}`,newPath:`${currentPath}/${f.name}`});await loadDirectory();showToast(`Renamed to "${newName}"`,'success');}
    else showToast('Rename failed.','error');
}

// ═══════════════════════════════════════════════
//  UNDO / REDO
// ═══════════════════════════════════════════════
function recordA(a){undoStack.push(a);redoStack=[];updateTb();}
async function performUndo(){if(!undoStack.length)return;const a=undoStack.pop();redoStack.push(a);await applyA(a);updateTb();showToast('Undone','success');}
async function performRedo(){if(!redoStack.length)return;const a=redoStack.pop();undoStack.push(a);await applyA(inv(a));updateTb();showToast('Redone','success');}
function inv(a){if(a.type==='rename'||a.type==='move')return{type:a.type,oldPath:a.newPath,newPath:a.oldPath};if(a.type==='create')return{type:'delete',path:a.path};if(a.type==='copy')return{type:'delete',path:a.path};return a;}
async function applyA(a){
    if(a.type==='rename'||a.type==='move')await api('/api/fs/rename',{userId:session.userId,oldPath:a.oldPath,newPath:a.newPath});
    else if(a.type==='delete')await api('/api/fs/delete',{userId:session.userId,path:a.path});
    await loadDirectory();
}

// ═══════════════════════════════════════════════
//  CONTEXT MENU
// ═══════════════════════════════════════════════
function initContextMenu(){
    document.querySelectorAll('.ctx-item').forEach(item=>{
        item.addEventListener('click',e=>{
            e.stopPropagation();
            document.getElementById('ctx-menu').classList.remove('open');
            if(!selectedItem)return;
            const cmd=item.dataset.cmd;
            if(cmd==='open')openItem(selectedItem);if(cmd==='cut')cutSelected();
            if(cmd==='copy')copySelected();if(cmd==='paste')pasteClipboard();
            if(cmd==='rename')startRename(selectedItem);if(cmd==='delete')deleteSelected();
        });
    });
}
function showCtxMenu(e,f){
    const m=document.getElementById('ctx-menu');m.classList.add('open');
    const vw=window.innerWidth,vh=window.innerHeight;
    let x=e.clientX,y=e.clientY;
    if(x+200>vw)x=vw-210;if(y+270>vh)y=vh-280;
    m.style.left=x+'px';m.style.top=y+'px';
    document.getElementById('ctx-paste').style.opacity=clipboard.items.length?'1':'0.4';
}

// ═══════════════════════════════════════════════
//  CREATE MODAL
// ═══════════════════════════════════════════════
function initCreateModal(){
    document.getElementById('btn-modal-cancel').addEventListener('click',closeCreateModal);
    document.getElementById('btn-modal-confirm').addEventListener('click',confirmCreate);
    document.getElementById('modal-create-input').addEventListener('keydown',e=>{if(e.key==='Enter')confirmCreate();if(e.key==='Escape')closeCreateModal();});
    document.getElementById('modal-create').addEventListener('click',e=>{if(e.target===document.getElementById('modal-create'))closeCreateModal();});
}
function openCreateModal(action,ext){
    pendingCreate={action,ext};
    const errEl=document.getElementById('modal-create-error');errEl.textContent='';
    if(action==='folder'){
        document.getElementById('modal-create-title').textContent='New Folder';
        document.getElementById('modal-create-ext').textContent='';document.getElementById('modal-create-ext').style.display='none';
        document.getElementById('modal-create-preview').textContent='';
        document.getElementById('modal-create-input').placeholder='Folder name';
    }else{
        const meta=getMeta('f'+ext,false);
        document.getElementById('modal-create-title').textContent=`New ${meta.label} File`;
        document.getElementById('modal-create-ext').textContent=ext;document.getElementById('modal-create-ext').style.display='inline';
        document.getElementById('modal-create-preview').textContent=FILE_TEMPLATES[ext]||'';
        document.getElementById('modal-create-input').placeholder='File name (without extension)';
    }
    document.getElementById('modal-create-input').value='';
    document.getElementById('modal-create').classList.add('open');
    setTimeout(()=>document.getElementById('modal-create-input').focus(),50);
}
function closeCreateModal(){document.getElementById('modal-create').classList.remove('open');pendingCreate=null;}
async function confirmCreate(){
    if(!pendingCreate)return;
    const{action,ext}=pendingCreate;
    const rawInput=document.getElementById('modal-create-input').value.trim();
    const errEl=document.getElementById('modal-create-error');
    const btn=document.getElementById('btn-modal-confirm');
    errEl.textContent='';
    if(!rawInput){errEl.textContent='Please enter a name.';return;}
    if(/[\/\\:*?"<>|]/.test(rawInput)){errEl.textContent='Name contains invalid characters.';return;}
    btn.disabled=true;btn.textContent='Creating...';
    try{
        if(action==='folder'){
            const path=`${currentPath}/${rawInput}`;
            const r=await api('/api/fs/mkdir',{userId:session.userId,path});
            if(r?.success){recordA({type:'create',path,isDir:true});closeCreateModal();await loadDirectory();showToast(`Folder "${rawInput}" created`,'success');}
            else errEl.textContent=r?.error||'Failed to create folder.';
        }else{
            const fileName=rawInput+ext;
            const r=await api('/api/fs/create-file',{userId:session.userId,dirPath:currentPath,fileName,content:FILE_TEMPLATES[ext]||''});
            if(r?.success){recordA({type:'create',path:`${currentPath}/${fileName}`,isDir:false});closeCreateModal();await loadDirectory();showToast(`"${fileName}" created`,'success');}
            else errEl.textContent=r?.error||'Failed to create file.';
        }
    }catch{errEl.textContent='Server connection error.';}
    finally{btn.disabled=false;btn.textContent='Create';}
}

// ═══════════════════════════════════════════════
//  UPLOAD MODAL
// ═══════════════════════════════════════════════
function initUploadModal(){
    const modal=document.getElementById('modal-upload');
    const dz=document.getElementById('drop-zone');
    const fi=document.getElementById('file-input');
    document.getElementById('btn-cancel-upload').addEventListener('click',()=>modal.classList.remove('open'));
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open');});
    document.getElementById('browse-trigger').addEventListener('click',()=>fi.click());
    dz.addEventListener('click',()=>fi.click());
    dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover');});
    dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
    dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragover');if(e.dataTransfer.files.length)uploadFiles([...e.dataTransfer.files]);});
    fi.addEventListener('change',e=>{if(e.target.files.length)uploadFiles([...e.target.files]);fi.value='';});
}

function openUploadModal(){
    document.getElementById('upload-dest-path').textContent=currentPath.replace('/home/student/','~/');
    document.getElementById('upload-list').innerHTML='';
    document.getElementById('modal-upload').classList.add('open');
}

async function uploadFiles(files){
    const listEl=document.getElementById('upload-list');
    for(const file of files){
        const item=document.createElement('div');item.className='xupload-item';
        item.innerHTML=`<span class="xupload-item-name">${esc(file.name)}</span><span class="xupload-item-status pending">Uploading...</span>`;
        listEl.appendChild(item);
        const st=item.querySelector('.xupload-item-status');
        try{
            const b64=await f2b64(file);
            const r=await api('/api/fs/upload',{
                userId:session.userId,
                targetPath:currentPath,
                fileContentBase64:b64,
                fileName:file.name
            });
            if(r?.success){
                st.textContent='✓ Done'; st.className='xupload-item-status ok';
                await loadDirectory();
            }else{
                st.textContent='✗ Failed: '+(r?.error||'unknown');
                st.className='xupload-item-status err';
            }
        }catch(e){
            st.textContent='✗ Error: '+e.message;
            st.className='xupload-item-status err';
        }
    }
}

function f2b64(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(f);});}

// ═══════════════════════════════════════════════
//  KEYBOARD
// ═══════════════════════════════════════════════
function initKeyboard(){
    document.addEventListener('keydown',e=>{
        const tag=document.activeElement.tagName.toLowerCase();
        if(tag==='input'||tag==='textarea')return;
        if(e.altKey){if(e.key==='ArrowLeft'){e.preventDefault();document.getElementById('btn-back').click();}if(e.key==='ArrowRight'){e.preventDefault();document.getElementById('btn-forward').click();}return;}
        if(e.ctrlKey||e.metaKey){
            if(e.key==='x'){e.preventDefault();cutSelected();}if(e.key==='c'){e.preventDefault();copySelected();}
            if(e.key==='v'){e.preventDefault();pasteClipboard();}if(e.key==='z'){e.preventDefault();performUndo();}
            if(e.key==='y'){e.preventDefault();performRedo();}if(e.key==='r'){e.preventDefault();loadDirectory();}
            return;
        }
        if(e.key==='F2'&&selectedItem){e.preventDefault();startRename(selectedItem);}
        if(e.key==='Delete'&&selectedItem){e.preventDefault();deleteSelected();}
        if(e.key==='Enter'&&selectedItem){e.preventDefault();openItem(selectedItem);}
        if(e.key==='Escape')clearSelection();
        if(e.key==='Backspace'&&!selectedItem){e.preventDefault();document.getElementById('btn-back').click();}
    });
}

// ═══════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════
async function api(url,body){try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return await r.json();}catch(e){console.error('[API]',url,e.message);return null;}}
function fmtSize(b){if(!b)return'0 B';const k=1024,u=['B','KB','MB','GB'];const i=Math.floor(Math.log(b)/Math.log(k));return(b/Math.pow(k,i)).toFixed(1)+' '+u[i];}
function fmtDate(ts){if(!ts)return'—';const d=new Date(ts*1000);return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showToast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className='xtoast xshow'+(type?' '+type:'');clearTimeout(t._t);t._t=setTimeout(()=>{t.className='xtoast';},2800);}
