'use client';
import {Children,isValidElement,useEffect,useId,useRef,useState,type SelectHTMLAttributes,type ReactElement,type ChangeEvent} from 'react';
import {createPortal} from 'react-dom';
type Props=SelectHTMLAttributes<HTMLSelectElement>&{onSearch?:(query:string)=>void};
export default function SearchSelect({children,value,defaultValue,onChange,disabled,required,name,onSearch,...props}:Props){
 const options=Children.toArray(children).flatMap(c=>isValidElement(c)?[c as ReactElement<{value?:string;children?:unknown;disabled?:boolean}>]:[]);
 const text=(v:unknown):string=>Array.isArray(v)?v.map(text).join(''):v==null?'':typeof v==='object'?'':String(v);
 const choices=options.map(o=>({value:String(o.props.value??text(o.props.children)),label:text(o.props.children),disabled:o.props.disabled}));
 const [local,setLocal]=useState(String(defaultValue??choices[0]?.value??''));const selected=String(value??local);
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[active,setActive]=useState(0);
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);const id=useId();
 const [rect,setRect]=useState({top:0,left:0,width:240});
 const filtered=choices.filter(o=>o.label.toLowerCase().includes(search.toLowerCase()));
 function close(){setOpen(false);trigger.current?.focus()}
 function choose(v:string){setLocal(v);onChange?.({target:{value:v,name},currentTarget:{value:v,name}} as ChangeEvent<HTMLSelectElement>);close()}
 useEffect(()=>{if(!open)return;const position=()=>{const r=trigger.current?.getBoundingClientRect();if(!r)return;const viewportHeight=window.visualViewport?.height||window.innerHeight;const width=Math.min(Math.max(r.width,220),window.innerWidth-16);const estimated=Math.min(330,viewportHeight-16);const top=r.bottom+5+estimated<=viewportHeight?r.bottom+5:Math.max(8,r.top-estimated-5);setRect({top,left:Math.max(8,Math.min(r.left,window.innerWidth-width-8)),width})};position();requestAnimationFrame(()=>input.current?.focus());
 const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen(false)};
 document.addEventListener('pointerdown',outside);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);
 return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position)};
 },[open]);
 return <span className="search-select">
 <button type="button" ref={trigger} id={props.id} className={'search-select-trigger '+(props.className||'')} role="combobox" aria-label={props['aria-label']} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" disabled={disabled} onClick={()=>{setSearch('');setActive(0);setOpen(v=>!v)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true)}}}>{choices.find(o=>o.value===selected)?.label||selected||'Select…'}<span aria-hidden="true">⌄</span></button>
 <input className="select-validation" tabIndex={-1} aria-hidden="true" name={name} value={selected} required={required} disabled={disabled} onChange={()=>{}} onInvalid={e=>{e.preventDefault();setOpen(true)}}/>
 {open&&createPortal(<div ref={panel} className="search-select-panel" style={{top:rect.top,left:Math.max(8,rect.left),width:rect.width,maxHeight:Math.max(160,window.innerHeight-rect.top-12)}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(i+1,filtered.length-1))}if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(i-1,0))}if(e.key==='Enter'){e.preventDefault();if(filtered[active]&&!filtered[active].disabled)choose(filtered[active].value)}if(e.key==='Tab')setOpen(false)}}>
 <input ref={input} aria-label="Search options" placeholder="Search…" value={search} onChange={e=>{setSearch(e.target.value);onSearch?.(e.target.value);setActive(0)}}/>
 <div role="listbox" id={id}>{filtered.map((o,i)=><button type="button" role="option" aria-selected={o.value===selected} disabled={o.disabled} key={o.value} className={i===active?'highlight':''} onClick={()=>choose(o.value)}>{o.label||'—'}</button>)}{!filtered.length&&<p>No matching options</p>}</div>
 </div>,document.body)}
 </span>
}
