export function parseWonInput(raw:string):number|null{
 const cleaned=raw.trim().replace(/^₩\s*/,'').replace(/원\s*$/,'').replace(/[\s,]/g,'');
 if(!/^\d+$/.test(cleaned))return null;
 const n=Number(cleaned);return Number.isSafeInteger(n)&&n>0&&n<=100000000?n:null;
}
export function validEntryDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
