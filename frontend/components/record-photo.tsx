'use client';
import {useState} from 'react';
export default function RecordPhoto({value,onChange,ur}:{value:string;onChange:(v:string)=>void;ur:boolean}){
 const [error,setError]=useState('');
 return <div className="form-field wide"><span>{ur?'تصویر':'Photo'}</span>{value&&<img src={value} alt={ur?'تصویر کا پیش منظر':'Photo preview'} className="photo-thumb"/>}
 <input aria-label={ur?'تصویر اپ لوڈ کریں':'Upload photo'} type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setError('');if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2_000_000){setError('Use a PNG, JPEG or WebP image under 2 MB.');return}const reader=new FileReader();reader.onerror=()=>setError('Unable to read image');reader.onload=()=>onChange(String(reader.result));reader.readAsDataURL(file)}}/>
 {value&&<button type="button" className="secondary-button" onClick={()=>onChange('')}>{ur?'تصویر ہٹائیں':'Remove photo'}</button>}{error&&<p role="alert" className="form-error">{error}</p>}</div>
}
