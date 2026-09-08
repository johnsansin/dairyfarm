'use client';
import {useEffect,useState} from 'react';
export function useLanguage(){
 const [ur,setUr]=useState(false);
 useEffect(()=>{setUr(localStorage.getItem('dm-language')==='ur')},[]);
 useEffect(()=>{document.documentElement.lang=ur?'ur':'en';document.documentElement.dir=ur?'rtl':'ltr'},[ur]);
 function toggle(){setUr(v=>{localStorage.setItem('dm-language',!v?'ur':'en');return !v})}
 return {ur,toggle,t:(en:string,urdu:string)=>ur?urdu:en};
}
export function useTheme(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{const saved=localStorage.getItem('dm-theme');setDark(saved==='dark')},[]);
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';if(dark)document.documentElement.style.colorScheme='dark';else document.documentElement.style.colorScheme=''},[dark]);
 function toggleDark(){setDark(v=>{localStorage.setItem('dm-theme',!v?'dark':'light');return !v})}
 return {dark,toggleDark};
}
