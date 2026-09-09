export function formatDate(value:unknown){
 const iso=String(value??'').slice(0,10);const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
 return match?`${match[3]}-${match[2]}-${match[1]}`:iso||'—';
}

export function formatDateTime(value:unknown){
 const date=new Date(String(value??''));if(Number.isNaN(date.getTime()))return '—';
 return `${String(date.getDate()).padStart(2,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${date.getFullYear()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
